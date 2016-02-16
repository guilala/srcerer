# <<title>>
server {
   listen *:443;
   server_name <<domains>>;
   root <<app>>;

   index index.html index.htm;
   error_page 404 500 502 503 504 /e0x.html;
   location = /e0x.html { root <<errors>>; }

   location /sorcerer/ {
      # destination
      proxy_pass http://127.0.0.1:2000/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-for $remote_addr;

      # socket
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_http_version 1.1;
      proxy_read_timeout 90s;
   }

   ssl on;
   ssl_certificate <<crt>>;
   ssl_certificate_key <<key>>;
   ssl_session_cache shared:SSL:1m;
   ssl_session_timeout 5m;
   ssl_ciphers HIGH:!aNULL:!MD5;
   ssl_prefer_server_ciphers on;
}
