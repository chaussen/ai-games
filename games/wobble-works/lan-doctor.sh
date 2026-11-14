#!/usr/bin/env bash
# WOBBLE WORKS - read-only LAN diagnostics. Changes nothing; safe to run anytime.
# Usage: bash lan-doctor.sh [port]   (default 3000)
PORT="${1:-3000}"
IPS=$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1)
echo "WOBBLE WORKS LAN doctor  (port $PORT)"
echo "=========================================="
echo
echo "1) IPv4 addresses on this machine"
ip -4 -brief addr show 2>/dev/null | awk '{print "   " $0}'
echo
echo "2) Default route (the NIC the phones should share)"
ip -4 route show default 2>/dev/null | awk '{print "   " $0}'
echo
echo "3) TCP listeners (look for :$PORT)"
ss -tlnp 2>/dev/null | awk '{print "   " $0}'
echo
echo "4) Firewall verdict"
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state 2>/dev/null | grep -q running; then
  ZONE=$(firewall-cmd --get-default-zone 2>/dev/null)
  echo "   firewalld: RUNNING, default zone $ZONE"
  firewall-cmd --list-all 2>/dev/null | awk '{print "   " $0}'
  if firewall-cmd --query-port="$PORT/tcp" >/dev/null 2>&1; then
    echo "   => port $PORT/tcp is ALLOWED"
  else
    echo "   => port $PORT/tcp is BLOCKED - this is why the phone fails"
    echo "      fix now : sudo firewall-cmd --zone=$ZONE --add-port=$PORT/tcp"
    echo "      keep it  : sudo firewall-cmd --permanent --zone=$ZONE --add-port=$PORT/tcp"
    echo "                sudo firewall-cmd --reload"
  fi
elif command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw status | awk '{print "   " $0}'
  echo "   fix: sudo ufw allow from 192.168.0.0/16 to any port $PORT proto tcp"
else
  echo "   no active host firewall detected"
fi
echo
echo "5) Self-test from this machine (proves the server, not the LAN)"
for ip in 127.0.0.1 $IPS; do
  printf '   http://%s:%s/config.js -> ' "$ip" "$PORT"
  curl -sS -m 3 -o /dev/null -w 'HTTP %{http_code}\n' "http://$ip:$PORT/config.js" 2>&1 || echo "FAILED (server not running?)"
done
echo
echo "6) Open on a phone on the SAME Wi-Fi:"
for ip in $IPS; do
  case "$ip" in 127.*|169.254.*) continue ;; esac
  echo "   http://$ip:$PORT/"
done
echo
echo "Step 5 OK but step 6 times out  -> firewall or AP/client isolation."
echo "Step 6: connection refused      -> wrong port, or the server is not running."
echo "Step 6 works but QR does not    -> QR has the wrong IP; use ?host= or LAN_IP=."
