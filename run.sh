#!/bin/bash

# Startup script for gunicorn running the tfc_api Flask app

source /home/tfc_prod/acp_lobby_screen/venv/bin/activate
export LOBBY_SCREEN_SETTINGS=/home/tfc_prod/acp_lobby_screen/lobby_screen.config

cd /home/tfc_prod/acp_lobby_screen

echo $(date) "gunicorn starting for icp_lobby_screen" >> /var/log/tfc_prod/gunicorn.log

nohup gunicorn --bind 127.0.0.1:9000 \
               --reload \
               --log-level debug \
               --error-logfile /var/log/tfc_prod/lobby_screen \
               --capture-output \
               --timeout 130 \
               --workers 2 \
               lobby_screen:app & disown

