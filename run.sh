#!/bin/bash

# Startup script for gunicorn running the tfc_api Flask app

source /home/tfc_prod/icp_lobby_panel/venv/bin/activate
export LOBBY_PANEL_SETTINGS=/home/tfc_prod/icp_lobby_panel/lobby_panel.config

cd /home/tfc_prod/icp_lobby_panel

echo $(date) "gunicorn starting for icp_lobby_panel" >> /var/log/tfc_prod/gunicorn.log

nohup gunicorn --bind 127.0.0.1:9000 \
               --reload \
               --log-level debug \
               --error-logfile /var/log/tfc_prod/lobby_panel \
               --capture-output \
               --timeout 130 \
               --workers 2 \
               lobby_panel:app & disown

