#!/bin/bash

export FLASK_APP=trains.py
export FLASK_DEBUG=1

export TRAINS_SETTINGS=trains.config

flask run 