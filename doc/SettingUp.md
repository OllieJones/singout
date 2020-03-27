# Setting up this project


Using this [fast-rtc-swarm npm package](https://github.com/mattkrick/fast-rtc-swarm).

Build a yarn-based express project.

Then
```
yarn add @mattkrick/fast-rtc-swarm
yarn add webrtc-adapter
yarn add  webpack webpack-cli webpack-node-externals --save-dev
yarn add standard --save-dev
yarn add webrtc-adapter

```

##Droplet rigging
Make the droplet, then log in as root,

```
adduser ollie
adduser ollie admin
adduser ollie sudo
mkdir /home/ollie/.ssh
cp /root/.ssh/authorized_keys /home/ollie/.ssh/authorized_keys
chown ollie:ollie /home/ollie/.ssh  /home/ollie/.ssh/authorized_keys
su ollie
cd /home/ollie
```

##Software load

```
sudo apt update ; sudo apt -y upgrade ; sudo apt -y autoremove
# nodejs
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt install -y build-essential nodejs nginx htop emacs-nox
# yarn
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install yarn
# no password for sudo (convenience)
sudo echo "$USER ALL=(ALL:ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/$USER
# certbot
sudo add-apt-repository -y ppa:certbot/certbot
sudo apt install -y certbot python-certbot-nginx

```

Then log back in as ordinary user.

## DNS

Rig the A and AAAA records for DNS to point to the machine.

`hostname --boot whatever-host-name`

## Firewall

[Read this](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-firewall-with-ufw-on-ubuntu-18-04).   Then set up the rules you need.

```
sudo ufw allow 'Nginx Full'
sudo ufw delete allow 'Nginx HTTP'
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw enable
sudo ufw status verbose```
```

## nginx configuration

Put in a /etc/nginx/sites-enabled/tencherry.xyz file looking something like this:

```
server {
    listen 80 default_server;
    listen [::]:80 default_server ipv6only=on;
    root /var/www/tencherry.xyz/html;
    index index.html index.htm index.nginx-debian.html;
    server_name tencherry.xyz www.tencherry.xyz;
    location / {
      proxy_pass http://localhost:3000;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_cache_bypass $http_upgrade;
      proxy_set_header        X-Real-IP       $remote_addr;
      proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
    }
 }
```

## Let's Encrypt

Run this.

 `sudo certbot --nginx`

Then edit `/etc/letsencrypt/options-ssl-nginx.conf` to put in the SSL configuration recommended by
[Mozilla's SSL Configuration Generator](https://ssl-config.mozilla.org/#server=nginx). 
For some reason `certbot` adds some absurdly obsolete cypher suites.