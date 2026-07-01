# Hostinger VPS Staging Deployment

Recommended staging hostnames:

- Student/public portal: `https://lms.buildyourbestself.org`
- Admin portal: `https://admin.lms.buildyourbestself.org`
- Mentor portal: `https://mentor.lms.buildyourbestself.org`
- API: `https://api.lms.buildyourbestself.org`

This keeps the three Vite apps separate and avoids routing conflicts.

## 1. DNS

Create these `A` records in DNS, all pointing to the Hostinger VPS public IP:

```txt
lms.buildyourbestself.org
admin.lms.buildyourbestself.org
mentor.lms.buildyourbestself.org
api.lms.buildyourbestself.org
```

Wait until DNS resolves before issuing SSL certificates.

## 2. Push To GitHub

From your local project folder:

```bash
cd /Users/user/Desktop/bybs-lms
git init
git add .
git commit -m "Prepare BYBS LMS staging deployment"
git branch -M main
git remote add origin git@github.com:YOUR_ORG_OR_USERNAME/bybs-lms.git
git push -u origin main
```

Keep the GitHub repository private while staging. Do not commit real `.env` files.

## 3. Server Packages

On the VPS, install:

```bash
sudo apt update
sudo apt install -y nginx git curl certbot python3-certbot-nginx build-essential
```

Install Node.js 20+ using your preferred method. Confirm:

```bash
node -v
npm -v
```

## 4. App User And Folder

```bash
sudo adduser --disabled-password --gecos "" bybs
sudo mkdir -p /var/www/bybs-lms
sudo chown -R bybs:bybs /var/www/bybs-lms
```

If the GitHub repository is private, create a deploy key:

```bash
sudo -u bybs mkdir -p /home/bybs/.ssh
sudo -u bybs ssh-keygen -t ed25519 -C "hostinger-bybs-lms" -f /home/bybs/.ssh/id_ed25519 -N ""
sudo -u bybs cat /home/bybs/.ssh/id_ed25519.pub
```

Add the printed public key in GitHub:

```txt
Repository -> Settings -> Deploy keys -> Add deploy key
```

Then clone the project:

```bash
sudo -u bybs git clone git@github.com:YOUR_ORG_OR_USERNAME/bybs-lms.git /var/www/bybs-lms
```

## 5. Environment Files

Copy and fill these files:

```bash
cd /var/www/bybs-lms
cp backend/staging.env.example backend/.env
cp admins/staging.env.example admins/.env
cp mentors/staging.env.example mentors/.env
cp students/staging.env.example students/.env
```

Fill real values for MongoDB, Cloudinary, Resend, `EMAIL_FROM`, admin alerts, and the initial super admin.

For the first staging setup only, you can temporarily set:

```txt
SEED_SUPER_ADMIN_ON_START=true
```

After the super admin exists, set it back to:

```txt
SEED_SUPER_ADMIN_ON_START=false
```

## 6. Build

```bash
cd /var/www/bybs-lms
npm ci
npm run build:admins
npm run build:mentors
npm run build:students
npm --workspace backend test
```

If embedded MongoDB is blocked on the VPS, use a staging MongoDB URI and rerun backend integration tests in CI or locally.

## 7. Nginx

```bash
cd /var/www/bybs-lms
sudo cp deploy/hostinger/nginx/bybs-lms-staging.conf /etc/nginx/sites-available/bybs-lms-staging
sudo ln -s /etc/nginx/sites-available/bybs-lms-staging /etc/nginx/sites-enabled/bybs-lms-staging
sudo nginx -t
sudo systemctl reload nginx
```

## 8. API Service

```bash
cd /var/www/bybs-lms
sudo cp deploy/hostinger/systemd/bybs-lms-api.service /etc/systemd/system/bybs-lms-api.service
sudo systemctl daemon-reload
sudo systemctl enable bybs-lms-api
sudo systemctl start bybs-lms-api
sudo systemctl status bybs-lms-api
```

If Node is not at `/usr/bin/node`, update `ExecStart` in the service file.

## 9. SSL

```bash
sudo certbot --nginx \
  -d lms.buildyourbestself.org \
  -d admin.lms.buildyourbestself.org \
  -d mentor.lms.buildyourbestself.org \
  -d api.lms.buildyourbestself.org
```

## 10. Smoke Test

```bash
cd /var/www/bybs-lms
bash deploy/hostinger/check-staging.sh
```

Then test manually:

- Visit public page
- Submit beta application
- Login as super admin
- Accept a beta tester
- Confirm email delivery
- Confirm tester login
- Change temporary password
- Upload a PDF/image/document and verify it lands in Cloudinary
- Submit and review a student assignment
- Create and resolve a support ticket

## 11. Updating Staging Later

```bash
cd /var/www/bybs-lms
sudo -u bybs git pull
npm ci
npm run build:admins
npm run build:mentors
npm run build:students
sudo systemctl restart bybs-lms-api
sudo systemctl status bybs-lms-api
```

## 12. Important

Do not use local `/uploads` as permanent staging storage. If Cloudinary is not configured, uploads will fall back locally only for development-style testing.
