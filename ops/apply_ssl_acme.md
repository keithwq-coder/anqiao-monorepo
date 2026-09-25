# 使用 acme.sh 申请 Let's Encrypt 免费证书
# 适用：Windows + Git Bash/WSL/Cygwin

# 1. 安装 acme.sh
git clone https://github.com/acmesh-official/acme.sh.git
cd acme.sh
./acme.sh --install

# 2. 为 crm.aibrain.wiki 申请证书
~/.acme.sh/acme.sh --set-default-ca --server letsencrypt
~/.acme.sh/acme.sh --issue -d crm.aistrain.wiki --standalone --force

# 3. 安装证书到系统目录
~/.acme.sh/acme.sh --install-cert -d crm.aistrain.wiki \
--key-file       /home/ubuntu/aibrain-ssl/crm.key \
--fullchain-file /home/ubuntu/aibrain-ssl/fullchain.crt \
--reloadcmd     "sudo systemctl reload nginx"
