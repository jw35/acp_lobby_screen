#!/usr/bin/env python3

# Simple script to test out the OpenWeatherMap API

import requests
import json
import os
import datetime
import pytz
from collections import OrderedDict
import iso8601


TOKEN = os.environ["METOFFICE_TOKEN"]
CAMBRIDGE = '310042'

API_BASE = 'http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/'



descriptions = {
    "NA": "Not available",
    "0": "Clear night",
    "1": "Sunny day",
    "2": "Partly cloudy",
    "3": "Partly cloudy",
    "4": "Not used",
    "5": "Mist",
    "6": "Fog",
    "7": "Cloudy",
    "8": "Overcast",
    "9": "Light rain shower",
    "10": "Light rain shower",
    "11": "Drizzle",
    "12": "Light rain",
    "13": "Heavy rain shower",
    "14": "Heavy rain shower",
    "15": "Heavy rain",
    "16": "Sleet shower",
    "17": "Sleet shower",
    "18": "Sleet",
    "19": "Hail shower",
    "20": "Hail shower",
    "21": "Hail",
    "22": "Light snow shower",
    "23": "Light snow shower",
    "24": "Light snow",
    "25": "Heavy snow shower",
    "26": "Heavy snow shower",
    "27": "Heavy snow",
    "28": "Thunder shower",
    "29": "Thunder shower",
    "30": "Thunder",
}

def mph_to_descr(speed):
    '''
    based on US Weather Bureau description from
    https://www.windows2universe.org/earth/Atmosphere/wind_speeds.html
    and Beaufort Scales from
    https://en.wikipedia.org/wiki/Beaufort_scale
    '''
    if speed < 1:        # 0
        return 'calm'
    elif speed < 8:      # 1, 2
        return 'light'
    elif speed < 8:      # 3, 4
        return 'moderate'
    elif speed < 19:     # 5
        return 'fresh'
    elif speed < 39:     # 6, 7
        return 'strong'
    elif speed < 73  :   # 8, 9, 10, 11
        return 'gale'
    else:                # 12 upward
        return 'huricane'

def weather_to_descr(code,default):
    if code in descriptions:
        return descriptions[code]
    else:
        return default

def display(result,title=None):

    (timestamp,data) = result

    print()
    if title:
        print(title)
    else:
        print('Forecast for {0}'.format(timestamp.strftime('%H:%M')))

    print()

    if data['T'] != data['F']:
        print('  {0} degC (feels like {1} degC)'.format(data['T'], data['F']))
    else:
        print('  {0} degC'.format(data['T']))

    if data['S'] != data['G']:
        print('  Wind {0} mph ({1}) (gust {2} mph), {3}'.format(
            data['S'],
            mph_to_descr(int(data['S'])),
            data['G'],
            data['D']))
    else:
        print('  Wind {0} mph ({1}), {2}'.format(
            data['S'],
            mph_to_descr(int(data['S'])),
            data['D']))

    print('  {0}'.format(weather_to_descr(data['W'],'')))




# Get current weather
r = requests.get(API_BASE + CAMBRIDGE, {"res": "3hourly", "key": TOKEN})
r.raise_for_status()
# https://stackoverflow.com/questions/35042216/requests-module-return-json-with-items-unordered
data = r.json(object_pairs_hook=OrderedDict)

#print(json.dumps(data, indent=4))
#print(type(data))

# Walk the (assumed date/time ordered) forecasts finding the one 
# dated immediately before now and the next two without making any
# assumptions about the interval between forecasts

previous = None
results = []
now = datetime.datetime.now(tz=pytz.UTC)
for period in data["SiteRep"]["DV"]["Location"]["Period"]:
    if len(results) >= 3:
        break
    day = iso8601.parse_date(period["value"][0:10],default_timezone=datetime.timezone.utc)
    print(day)
    for rep in period["Rep"]:
        timestamp = day + datetime.timedelta(minutes=int(rep["$"]))
        if timestamp > now and not results:
            results.append(previous)
        if timestamp > now:
            results.append((timestamp,rep))
        if len(results) >= 3:
            break
        previous = ((timestamp,rep))

print()
issued = iso8601.parse_date(data["SiteRep"]["DV"]["dataDate"])
print("Weather for {0} issued {1}".format(data["SiteRep"]["DV"]["Location"]["name"],
                                      issued.strftime("%H:%M")))

display(results[0],'Now')
display(results[1])
display(results[2])

print()

#print()
#print('Weather for {0}'.format(current['name']));
#print()
#
#print('Current weather (at {0})'.format(
#    datetime.datetime.fromtimestamp(current['dt']).strftime('%H:%M')));
#
#print()
#print('  {0:.0f} deg C'.format(current['main']['temp']))
#print('  Wind {1}, {0}'.format(speed_to_force(current['wind']['speed']),
#    deg_to_ordinal(current['wind']['deg'])))
#for weather in current['weather']:
#    print('  {0}'.format(code_to_weather(weather['id'], weather['description'])))
#print()
#
## Get forecast weather
#r = requests.get(FORECAST_WEATHER, params=params)
#r.raise_for_status()
#forecast = r.json()
#
##print(json.dumps(forecast, indent=1))
#
#for data in forecast['list']:
#
#    print("Forecast for {0}".format(datetime.datetime.fromtimestamp(data['dt']).strftime('%H:%M')))
#    print()
#    print('  {0:.0f} deg C'.format(data['main']['temp']))
#    print('  Wind {1}, {0}'.format(speed_to_force(data['wind']['speed']),
#        deg_to_ordinal(data['wind']['deg'])))
#    #if 'rain' in data and '3h' in data['rain']:
#    #    print('  {0:5.3f}mm rain in previous 3 hours'.format(data['rain']['3h']))
#    #if 'snow' in data and '3h' in data['snow']:
#    #    print('  {0:5.3f}mm snow in previous 3 hours'.format(data['snow']['3h']))
#    for weather in data['weather']:
#        print('  {0}'.format(code_to_weather(weather['id'], weather['description'])))
#    print()
#
