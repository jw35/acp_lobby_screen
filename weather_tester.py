#!/usr/bin/env python3

# Simple script to test out the OpenWeatherMap API

import requests;
import json;
import os;
import datetime;


TOKEN = os.environ["OWM_TOKEN"]
CAMBRIDGE = '2653941'
API_BASE = 'http://api.openweathermap.org/data/2.5/'
CURRENT_WEATHER = API_BASE + 'weather'
FORECAST_WEATHER = API_BASE + 'forecast'

ordinal = ['North','North-East','East','South-East','South','South-West','West','North-West']

params = {'id': CAMBRIDGE,
          'APPID': TOKEN,
          'units': 'metric',
          'cnt': 3
         }

descriptions = {
    200: "Thunderstorm and light rain",
    201: "Thunderstorm with rain",
    202: "thunderstorm with heavy rain",
    210: "Light thunderstorm",
    211: "Thunderstorm",
    212: "Heavy thunderstorm",
    221: "Thunderstorm",
    230: "Thunderstorm with light drizzle",
    231: "Thunderstorm with drizzle",
    232: "Thunderstorm with heavy drizzle",
    300: "Light drizzle",
    301: "Drizzle",
    302: "Heavy drizzle",
    310: "Light drizzle and rain",
    311: "Drizzle and rain",
    312: "Heavy drizzle and rain",
    313: "Rain and drizzle showers",
    314: "Heavy rain and drizzle showers",
    321: "Drizzle showers",
    500: "Light rain",
    501: "Moderate rain",
    502: "Heavy rain",
    503: "Very heavy rain",
    504: "Extremely heavy rain",
    511: "Freezing rain",
    520: "Light rain showers",
    521: "Rain showers",
    522: "Heavy rain showers",
    531: "Rain showers",
    600: "Light snow",
    601: "Snow",
    602: "Heavy snow",
    611: "Sleet",
    612: "Sleet shower",
    615: "Light rain and snow",
    616: "Rain and snow",
    620: "Light snow shower",
    621: "Snow shower",
    622: "Heavy snow shower",
    701: "Mist",
    711: "Smoke",
    721: "Haze",
    731: "Sand, dust whirls",
    741: "Fog",
    751: "Sand",
    761: "Dust",
    762: "Volcanic ash",
    771: "Squalls",
    781: "Tornado",
    800: "Clear sky",
    801: "Scattered clouds",
    802: "Scattered clouds",
    803: "Broken clouds",
    804: "Overcast",
    900: "Tornado",
    901: "Tropical storm",
    902: "Hurricane",
    903: "Cold",
    904: "Hot",
    905: "Windy",
    906: "Hail",
    951: "Calm",
    952: "Light breeze",
    953: "Gentle breeze",
    954: "Moderate breeze",
    955: "Fresh breeze",
    956: "Strong breeze",
    957: "High wind",
    958: "Gale",
    959: "Severe gale",
    960: "Storm",
    961: "Violent storm",
    962: "Hurricane"
}

def deg_to_ordinal(deg):
    index = int((deg + 22.5) // 45)
    if index == 8: index = 0
    return ordinal[index]

def speed_to_force(speed):
    '''
    baewd on US Weather Bureau description from
    https://www.windows2universe.org/earth/Atmosphere/wind_speeds.html
    and Beaufort Scales from
    https://en.wikipedia.org/wiki/Beaufort_scale
    '''
    if speed < 3.4:      # 0, 1, 2
        return 'Light'
    elif speed < 8:      # 3, 4
        return 'Moderate'
    elif speed < 10.8:   # 5
        return 'Fresh'
    elif speed < 17.2:   # 6, 7
        return 'Strong'
    elif speed < 32.7:   # 8, 9, 10, 11
        return 'Gale'
    else:                # 12 upward
        return 'Huricane'

def code_to_weather(code,default):
    if code in descriptions:
        return descriptions[code]
    else:
        return default

# Get current weather
r = requests.get(CURRENT_WEATHER, params=params)
r.raise_for_status()
current = r.json()

#print(json.dumps(current, indent=1))

print()
print('Weather for {0}'.format(current['name']));
print()

print('Current weather (at {0})'.format(
    datetime.datetime.fromtimestamp(current['dt']).strftime('%H:%M')));

print()
print('  {0:.0f} deg C'.format(current['main']['temp']))
print('  Wind {1}, {0}'.format(speed_to_force(current['wind']['speed']),
    deg_to_ordinal(current['wind']['deg'])))
for weather in current['weather']:
    print('  {0}'.format(code_to_weather(weather['id'], weather['description'])))
print()

# Get forecast weather
r = requests.get(FORECAST_WEATHER, params=params)
r.raise_for_status()
forecast = r.json()

#print(json.dumps(forecast, indent=1))

for data in forecast['list']:

    print("Forecast for {0}".format(datetime.datetime.fromtimestamp(data['dt']).strftime('%H:%M')))
    print()
    print('  {0:.0f} deg C'.format(data['main']['temp']))
    print('  Wind {1}, {0}'.format(speed_to_force(data['wind']['speed']),
        deg_to_ordinal(data['wind']['deg'])))
    #if 'rain' in data and '3h' in data['rain']:
    #    print('  {0:5.3f}mm rain in previous 3 hours'.format(data['rain']['3h']))
    #if 'snow' in data and '3h' in data['snow']:
    #    print('  {0:5.3f}mm snow in previous 3 hours'.format(data['snow']['3h']))
    for weather in data['weather']:
        print('  {0}'.format(code_to_weather(weather['id'], weather['description'])))
    print()

