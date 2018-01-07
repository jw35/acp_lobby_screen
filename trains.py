from flask import Flask, g, render_template, jsonify, request, json, abort
import re
import logging
from logging import Formatter
import zeep

WSDL = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/wsdl.aspx?ver=2017-10-01'


app= Flask(__name__)
app.config.from_object(__name__)
app.config.update(dict(
    SEND_FILE_MAX_AGE_DEFAULT=0,
))
app.config.from_envvar('TRAINS_SETTINGS', silent=False)
# Check we loaded a config
assert 'NRE_API_KEY' in app.config


# Direct logs to STDERR even when not in debug
@app.before_first_request
def setup_logging():
    if not app.debug:
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(Formatter('[%(asctime)s] [%(process)d] [%(levelname)s] %(message)s'))
        app.logger.addHandler(stream_handler)
        app.logger.setLevel(logging.INFO)


@app.route('/')
def hello_world():
    return render_template('index.html')


@app.route('/departure-board', methods=['GET'])
def departure_board():
    '''
    Retrieve a 'DepartureBoard' from National Rail Enquiries
    and render it as a web page
    '''

    station = request.args.get('station', '')

    client = zeep.Client(wsdl=WSDL)
    data = client.service.GetDepartureBoard(numRows=50,crs=station,
        _soapheaders={"AccessToken":app.config["NRE_API_KEY"]},
        timeOffset=0)

    return render_template('departure-board.html', data=data)


