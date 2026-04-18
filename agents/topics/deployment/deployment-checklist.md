# Deployment Checklist

Use this checklist for the current production deployment path.

Current assumptions:

- deploy to a fresh Linux server
- use a simple `git pull` update flow at first
- run a Node app behind a reverse proxy
- prefer a secure baseline over automation complexity

## Provisioning

- [ ] Create the new server instance
- [ ] Record the server IP, region, distro, and size
- [ ] Confirm SSH access method and save the login details securely
- [ ] Verify DNS control for the deployment domain

## Base Security

- [ ] Update system packages
- [ ] Create a non-root sudo user
- [ ] Install SSH public keys for admin access
- [ ] Verify key-based login works before changing SSH settings
- [ ] Disable root SSH login
- [ ] Disable password SSH login if key-based access is working
- [ ] Configure a basic firewall
- [ ] Install and configure `fail2ban`
- [ ] Set the server timezone if needed

## Runtime Setup

- [ ] Install `git`
- [ ] Install Node.js and `npm`
- [ ] Install `nginx`
- [ ] Choose the process manager
- [ ] Install `pm2` if we use it

## App Setup

- [ ] Create the app directory
- [ ] Create a dedicated app user if needed
- [ ] Configure repo access for server-side `git pull`
- [ ] Clone the repo onto the server
- [ ] Add production environment configuration outside the repo
- [ ] Install app dependencies
- [ ] Build the app if the production path requires it

## Process And Web Server

- [ ] Create the app start command
- [ ] Start the app with `pm2` or the chosen service manager
- [ ] Configure startup on reboot
- [ ] Configure `nginx` as the reverse proxy
- [ ] Test local server-to-app connectivity

## TLS And Domain

- [ ] Point DNS to the new server
- [ ] Confirm the certificate renewal files are ready
- [ ] Install the certificate and chain files
- [ ] Configure HTTPS in `nginx`
- [ ] Verify certificate validity and served chain

## First Deploy

- [ ] Run the first `git pull` based deploy
- [ ] Rebuild production bundles if the app serves compiled frontend assets
- [ ] Restart or reload the app process
- [ ] Verify the app is serving correctly at `/gc`
- [ ] Smoke test the main user flow
- [ ] Check app logs and web server logs

## Ongoing Deploy Flow

- [ ] Document the exact deploy commands
- [ ] Document rollback steps
- [ ] Document where logs live
- [ ] Document certificate renewal/install steps
- [ ] Document who owns server access and DNS access

Current verified live runbook:

- [Production Deploy Runbook](/c:/dev/poly-gc-react/agents/topics/deployment/production-deploy-runbook.md)
