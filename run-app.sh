#!/bin/bash

export FLASK_APP=lobby_pannel.py
export FLASK_DEBUG=1

export LOBBY_PANNEL_SETTINGS=lobby_pannel.config

flask run 