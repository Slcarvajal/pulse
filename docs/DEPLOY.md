# DEPLOY — PULSE on AWS Lightsail (Ubuntu 22.04)


## 1. Lightsail + DNS
- Lightsail → Create instance → Linux, Ubuntu 22.04, $5 plan → Create.
- Networking → attach a static IP. Firewall: allow HTTP 80 and HTTPS 443.
- DNS (your registrar): A record `pulse` → the static IP. Wait for it to resolve.

## 2. Server packages
```bash
ssh ubuntu@<static-ip>
sudo apt update && sudo apt install -y git curl debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
sudo npm install -g pm2
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile   # 512MB box: needed for npm ci/vite
```

## 3. App
```bash
cd ~ && git clone https://github.com/Slcarvajal/pulse.git pulse && cd pulse
cp .env.example .env && nano .env
```
Fill `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (from Google Cloud console),
`BASE_URL=https://carvafit.carvajalgoenaga.com`, `PORT=3000`, `AGE=<your age>`, `TZ=America/Bogota`.
```bash
npm ci && npm run icons && npm run build
pm2 start ecosystem.config.cjs && pm2 save
pm2 startup   # run the sudo command it prints
```

## 4. Caddy (HTTPS)
```bash
sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
```
Caddy obtains the Let's Encrypt certificate automatically once DNS resolves.

## 5. Google OAuth (console, by hand)
- Enable Google Health API; OAuth consent screen → External → Testing → add your Gmail as test user.
- Credentials → OAuth client → Web application → redirect URI `https://carvafit.carvajalgoenaga.com/api/auth/callback`.
- Add the read scopes listed in the header comment of `server/google.js`.

## 6. First run (iPhone, Safari)
1. Open `https://carvafit.carvajalgoenaga.com/api/auth` → sign in → allow → redirected to `/`.
2. Open `https://carvafit.carvajalgoenaga.com` → Share → **Add to Home Screen** → open the Pulse icon.

## 7. Updates and refresh
```bash
cd ~/pulse && npm run deploy
```
Optional cron (`crontab -e`): `0 7 * * * curl -s https://carvafit.carvajalgoenaga.com/api/health?refresh=1 >/dev/null`
