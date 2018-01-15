#!/bin/bash

export FLASK_APP=lobby_screen.py
export FLASK_DEBUG=1

export LOBBY_SCREEN_SETTINGS=lobby_screen.config

flask run
