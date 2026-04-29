#!/usr/bin/env bash
#
# HtmlHub 自动部署脚本
# 用法:
#   ./deploy.sh              # 默认部署（拉取最新代码 -> 构建 -> 启动）
#   ./deploy.sh --rollback   # 回滚到上一个版本
#   ./deploy.sh --restart    # 仅重启服务（不重新构建）
#   ./deploy.sh --stop       # 停止所有服务
#   ./deploy.sh --status     # 查看服务状态
#   ./deploy.sh --logs       # 查看服务日志
#   ./deploy.sh --backup     # 仅执行数据备份
#
# 环境变量（可在 .env 中配置）:
#   DEPLOY_BRANCH    - 部署分支，默认 main
#   DEPLOY_PORT      - 对外端口，默认 8088
#   COMPOSE_PROJECT  - compose 项目名，默认 htmlhub
#   BACKUP_DIR       - 备份目录，默认 ./backups
#   HEALTH_TIMEOUT   - 健康检查超时（秒），默认 120
#   KEEP_BACKUPS     - 保留备份数量，默认 5

set -euo pipefail

# ============================================================
# 颜色输出
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # 无颜色

log_info()  { echo -e "${BLUE}[INFO]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; }

# ============================================================
# 路径与配置
# ============================================================
# 脚本所在目录（deploy/）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# 项目根目录
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# compose 文件路径
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

# 加载 .env（如果存在）
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    # shellcheck disable=SC1091
    source "$SCRIPT_DIR/.env"
fi

DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_PORT="${DEPLOY_PORT:-8088}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-htmlhub}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/backups}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"

# Docker Compose 命令（兼容 v1 / v2）
if docker compose version &>/dev/null; then
    DC="docker compose -f $COMPOSE_FILE -p $COMPOSE_PROJECT"
else
    DC="docker-compose -f $COMPOSE_FILE -p $COMPOSE_PROJECT"
fi

# ============================================================
# 工具函数
# ============================================================

# 获取当前 Git commit 短哈希
get_current_commit() {
    git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown"
}

# 获取当前 Git 分支
get_current_branch() {
    git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

# 记录部署版本
save_deploy_info() {
    local commit="$1"
    local timestamp
    timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    cat > "$SCRIPT_DIR/.last-deploy" <<EOF
DEPLOY_COMMIT=$commit
DEPLOY_TIME=$timestamp
DEPLOY_BRANCH=$DEPLOY_BRANCH
EOF
    log_info "部署信息已保存: commit=$commit, time=$timestamp"
}

# 读取上次部署信息
load_last_deploy() {
    if [[ -f "$SCRIPT_DIR/.last-deploy" ]]; then
        # shellcheck disable=SC1091
        source "$SCRIPT_DIR/.last-deploy"
        echo "$DEPLOY_COMMIT"
    else
        echo ""
    fi
}

# ============================================================
# 数据备份
# ============================================================
do_backup() {
    log_info "开始数据备份..."
    mkdir -p "$BACKUP_DIR"

    local timestamp
    timestamp="$(date '+%Y%m%d_%H%M%S')"
    local commit
    commit="$(get_current_commit)"
    local backup_name="backup_${timestamp}_${commit}"
    local backup_path="$BACKUP_DIR/$backup_name"

    mkdir -p "$backup_path"

    # 备份数据库文件（通过 Docker volume 拷贝）
    local volume_name="${COMPOSE_PROJECT}_htmlreport-data"
    if docker volume inspect "$volume_name" &>/dev/null; then
        log_info "正在备份 Docker 数据卷: $volume_name"
        docker run --rm \
            -v "$volume_name":/source:ro \
            -v "$backup_path":/backup \
            alpine:3.19 \
            sh -c "cp -a /source/. /backup/ 2>/dev/null || true"
        log_ok "数据卷备份完成: $backup_path"
    else
        log_warn "数据卷 $volume_name 不存在，跳过备份"
    fi

    # 保存当前 compose 配置快照
    cp "$COMPOSE_FILE" "$backup_path/docker-compose.yml.bak"
    cp "$SCRIPT_DIR/nginx.conf" "$backup_path/nginx.conf.bak" 2>/dev/null || true

    # 清理旧备份（保留最近 N 个）
    local backup_count
    backup_count=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | wc -l)
    if (( backup_count > KEEP_BACKUPS )); then
        local to_delete=$((backup_count - KEEP_BACKUPS))
        log_info "清理旧备份，删除最早的 $to_delete 个..."
        find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" | sort | head -n "$to_delete" | while read -r dir; do
            rm -rf "$dir"
            log_info "已删除: $(basename "$dir")"
        done
    fi

    log_ok "备份完成: $backup_name"
}

# ============================================================
# 健康检查
# ============================================================
health_check() {
    log_info "开始健康检查（超时: ${HEALTH_TIMEOUT}s）..."

    local elapsed=0
    local interval=5
    local api_ok=false
    local web_ok=false

    while (( elapsed < HEALTH_TIMEOUT )); do
        # 检查 API 服务
        if ! $api_ok; then
            if curl -sf "http://localhost:${DEPLOY_PORT}/api/" &>/dev/null; then
                api_ok=true
                log_ok "API 服务就绪"
            fi
        fi

        # 检查 Web 服务
        if ! $web_ok; then
            if curl -sf "http://localhost:${DEPLOY_PORT}/" &>/dev/null; then
                web_ok=true
                log_ok "Web 服务就绪"
            fi
        fi

        if $api_ok && $web_ok; then
            log_ok "所有服务健康检查通过！"
            return 0
        fi

        sleep "$interval"
        elapsed=$((elapsed + interval))
        log_info "等待服务就绪... (${elapsed}s/${HEALTH_TIMEOUT}s)"
    done

    log_error "健康检查超时！"
    if ! $api_ok; then
        log_error "  - API 服务未就绪"
    fi
    if ! $web_ok; then
        log_error "  - Web 服务未就绪"
    fi
    return 1
}

# ============================================================
# 核心部署流程
# ============================================================
do_deploy() {
    local start_time
    start_time=$(date +%s)

    log_info "=========================================="
    log_info "  HtmlHub 自动部署"
    log_info "=========================================="
    log_info "项目目录: $PROJECT_DIR"
    log_info "部署分支: $DEPLOY_BRANCH"
    log_info "对外端口: $DEPLOY_PORT"

    # 1. 拉取最新代码
    log_info "[1/5] 拉取最新代码..."
    cd "$PROJECT_DIR"

    # 检查是否有未提交的更改
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        log_warn "检测到未提交的本地更改"
        log_info "暂存本地更改 (git stash)..."
        git stash push -m "deploy-auto-stash-$(date '+%Y%m%d_%H%M%S')"
    fi

    git fetch origin "$DEPLOY_BRANCH"
    git checkout "$DEPLOY_BRANCH"
    git pull origin "$DEPLOY_BRANCH"

    local current_commit
    current_commit="$(get_current_commit)"
    local last_commit
    last_commit="$(load_last_deploy)"

    if [[ "$current_commit" == "$last_commit" ]]; then
        log_warn "当前版本 ($current_commit) 与上次部署一致，无需重新部署"
        read -rp "是否强制重新部署？[y/N] " force
        if [[ "$force" != "y" && "$force" != "Y" ]]; then
            log_info "部署取消"
            return 0
        fi
    fi

    log_ok "代码已更新到: $current_commit"

    # 2. 备份数据
    log_info "[2/5] 备份现有数据..."
    do_backup

    # 3. 构建镜像
    log_info "[3/5] 构建 Docker 镜像..."
    $DC build --no-cache --parallel 2>&1 | while IFS= read -r line; do
        echo "  $line"
    done
    log_ok "镜像构建完成"

    # 4. 启动服务
    log_info "[4/5] 启动服务..."
    $DC down --remove-orphans 2>/dev/null || true
    $DC up -d
    log_ok "服务已启动"

    # 5. 健康检查
    log_info "[5/5] 执行健康检查..."
    if health_check; then
        save_deploy_info "$current_commit"
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo ""
        log_ok "=========================================="
        log_ok "  部署成功！"
        log_ok "  版本: $current_commit"
        log_ok "  耗时: ${duration}s"
        log_ok "  访问: http://localhost:${DEPLOY_PORT}"
        log_ok "=========================================="
    else
        log_error "部署后健康检查失败！"
        log_warn "正在查看服务日志以排查问题..."
        $DC logs --tail=50
        echo ""
        log_error "你可以执行以下操作："
        log_error "  1. 查看完整日志: $0 --logs"
        log_error "  2. 回滚到上一版本: $0 --rollback"
        return 1
    fi
}

# ============================================================
# 回滚
# ============================================================
do_rollback() {
    log_info "=========================================="
    log_info "  HtmlHub 版本回滚"
    log_info "=========================================="

    local last_commit
    last_commit="$(load_last_deploy)"

    if [[ -z "$last_commit" ]]; then
        log_error "未找到上次部署记录，无法自动回滚"
        log_info "请手动指定回滚版本: git checkout <commit> && $0"
        return 1
    fi

    # 查找最近的备份
    local latest_backup
    latest_backup=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" 2>/dev/null | sort -r | head -n 1)

    if [[ -z "$latest_backup" ]]; then
        log_error "未找到可用的备份，无法回滚数据"
        return 1
    fi

    log_info "将回滚到备份: $(basename "$latest_backup")"
    read -rp "确认回滚？此操作将停止当前服务并恢复数据 [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "回滚取消"
        return 0
    fi

    # 停止服务
    log_info "停止当前服务..."
    $DC down --remove-orphans 2>/dev/null || true

    # 回退代码
    log_info "回退代码到: $last_commit"
    cd "$PROJECT_DIR"
    git checkout "$last_commit"

    # 恢复数据卷
    local volume_name="${COMPOSE_PROJECT}_htmlreport-data"
    if docker volume inspect "$volume_name" &>/dev/null && [[ -d "$latest_backup" ]]; then
        log_info "恢复数据卷..."
        docker run --rm \
            -v "$volume_name":/target \
            -v "$latest_backup":/backup:ro \
            alpine:3.19 \
            sh -c "rm -rf /target/* && cp -a /backup/. /target/ 2>/dev/null || true"
        log_ok "数据卷已恢复"
    fi

    # 重新构建并启动
    log_info "重新构建并启动服务..."
    $DC build --parallel
    $DC up -d

    if health_check; then
        log_ok "回滚成功！"
    else
        log_error "回滚后健康检查失败，请手动排查"
        return 1
    fi
}

# ============================================================
# 其他命令
# ============================================================
do_restart() {
    log_info "重启服务..."
    $DC restart
    health_check
}

do_stop() {
    log_info "停止所有服务..."
    $DC down --remove-orphans
    log_ok "服务已停止"
}

do_status() {
    log_info "=========================================="
    log_info "  HtmlHub 服务状态"
    log_info "=========================================="

    echo ""
    $DC ps

    echo ""
    local last_commit
    last_commit="$(load_last_deploy)"
    if [[ -n "$last_commit" ]]; then
        log_info "上次部署版本: $last_commit"
        if [[ -f "$SCRIPT_DIR/.last-deploy" ]]; then
            # shellcheck disable=SC1091
            source "$SCRIPT_DIR/.last-deploy"
            log_info "上次部署时间: ${DEPLOY_TIME:-unknown}"
        fi
    fi

    local current_commit
    current_commit="$(get_current_commit)"
    local current_branch
    current_branch="$(get_current_branch)"
    log_info "当前代码版本: $current_commit ($current_branch)"

    # 显示备份信息
    local backup_count
    backup_count=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "backup_*" 2>/dev/null | wc -l)
    log_info "可用备份数量: $backup_count"
}

do_logs() {
    $DC logs --tail=100 -f
}

# ============================================================
# 清理 Docker 资源
# ============================================================
do_cleanup() {
    log_info "清理无用的 Docker 资源..."
    docker image prune -f --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" 2>/dev/null || true
    docker builder prune -f 2>/dev/null || true
    log_ok "清理完成"
}

# ============================================================
# 入口
# ============================================================
main() {
    # 检查依赖
    for cmd in docker git curl; do
        if ! command -v "$cmd" &>/dev/null; then
            log_error "缺少必要工具: $cmd，请先安装"
            exit 1
        fi
    done

    local action="${1:-deploy}"

    case "$action" in
        deploy|--deploy|-d)
            do_deploy
            ;;
        --rollback|-r)
            do_rollback
            ;;
        --restart)
            do_restart
            ;;
        --stop)
            do_stop
            ;;
        --status|-s)
            do_status
            ;;
        --logs|-l)
            do_logs
            ;;
        --backup|-b)
            do_backup
            ;;
        --cleanup)
            do_cleanup
            ;;
        --help|-h)
            echo ""
            echo "HtmlHub 自动部署脚本"
            echo ""
            echo "用法: $0 [命令]"
            echo ""
            echo "命令:"
            echo "  deploy, --deploy, -d    部署最新版本（默认）"
            echo "  --rollback, -r          回滚到上一个版本"
            echo "  --restart               重启服务（不重新构建）"
            echo "  --stop                  停止所有服务"
            echo "  --status, -s            查看服务状态"
            echo "  --logs, -l              查看服务日志（实时跟踪）"
            echo "  --backup, -b            仅执行数据备份"
            echo "  --cleanup               清理无用的 Docker 资源"
            echo "  --help, -h              显示帮助信息"
            echo ""
            echo "环境变量（可在 deploy/.env 中配置）:"
            echo "  DEPLOY_BRANCH    部署分支（默认: main）"
            echo "  DEPLOY_PORT      对外端口（默认: 8088）"
            echo "  COMPOSE_PROJECT  Compose 项目名（默认: htmlhub）"
            echo "  BACKUP_DIR       备份目录（默认: deploy/backups）"
            echo "  HEALTH_TIMEOUT   健康检查超时秒数（默认: 120）"
            echo "  KEEP_BACKUPS     保留备份数量（默认: 5）"
            echo ""
            ;;
        *)
            log_error "未知命令: $action"
            echo "使用 $0 --help 查看帮助"
            exit 1
            ;;
    esac
}

main "$@"
