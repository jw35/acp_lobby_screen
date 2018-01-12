#!/bin/bash

export FLASK_APP=lobby_panel.py
export FLASK_DEBUG=1

export LOBBY_PANEL_SETTINGS=lobby_panel.config

flask run 