#!/usr/bin/env python3

# Simple script to test out the OpenWeatherMap API

import requests;
import json;
import os;


TOKEN = os.environ["OWM_TOKEN"]
CAMBRIDGE = '2653941'
API_BASE = 'http://api.openweathermap.org/data/2.5/'
CURRENT_WEATHER = API_BASE + 'weather'
FORECAST_WEATHER = API_BASE + 'forecast'

ordinal = ['North','North-East','East','South-East','South','South-West','West','North-West']

params = {'id': CAMBRIDGE,
          'APPID': TOKEN,
          'units': 'metric',
          'cnt': 40}

def deg_to_ordinal(deg):
    index = int((deg + 22.5) // 45)
    if index == 8: index = 0
    print(index)
    return ordinal[index]

# Get current weather
r = requests.get(CURRENT_WEATHER, params=params)
r.raise_for_status()
current = r.json()

#print(json.dumps(current, indent=1))

print('Current weather for {0}'.format(current['name']))
print()
print('Temperature {0} dec C'.format(current['main']['temp']))
print('Wind {0} m/s, {1}'.format(current['wind']['speed'], deg_to_ordinal(current['wind']['deg'])))
print('{0}'.format(current['weather'][0]['description']))
print()

# Get forecast weather
r = requests.get(FORECAST_WEATHER, params=params)
r.raise_for_status()
forecast = r.json()

print(json.dumps(forecast, indent=1))

for count in range(0,40):

    data = forecast['list'][count]

    print("Forecast for {0}".format(data['dt_txt']))
    print()
    print('Temperature {0} dec C ({1}...{2})'.format(data['main']['temp'], data['main']['temp_min'],data['main']['temp_max']))
    print('Wind {0} m/s, from the {1} ({2})'.format(data['wind']['speed'], deg_to_ordinal(data['wind']['deg']),data['wind']['deg']))
    if 'rain' in data and '3h' in data['rain']:
        print('Rain {0} mm'.format(data['rain']['3h']))
    if 'snow' in data and '3h' in data['snow']:
        print('Snow {0} mm'.format(data['snow']['3h']))
    print('{0}'.format(data['weather'][0]['description']))
    print()

