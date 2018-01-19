ACP Lobby Screen Development Environment
========================================

This repository contains a collection of widgets for Adaptive City
Platform 'Lobby Screens', along with an interim framework for
displaying them.

The interim framework is built in [Flask](http://flask.pocoo.org/).

In this interim framework, widgets are stored as folders under `static/`.
Layouts (particular arrangements of widgets) are implemented by
[JINJA2](http://jinja.pocoo.org/) templates invoked from Flask
in `templates/`. See [widgets.md](widgets.md) for documentation on
the interface between the framework and the widgets.

Development deployment
======================

The environment can be run locally using Flask's built-in development
server. Clone this repository into an appropriate directory and from
that directory:

```
$ python3 -mvenv venv
$ source venv/bin/activate
$ pip3 install -r requirements.txt
```

Create (or copy) a file `setup_token` containing API tokens for National
Rail Enquiries ['Darwin LDB Webservice'](http://www.nationalrail.co.uk/100296.aspx) and for The Met
Office's [DataPoint service](https://www.metoffice.gov.uk/datapoint):

```
export NRE_TOKEN=...
export METOFFICE_TOKEN...
```

To run the environment:

```
$ source setup_token
$ ./run-app.sh
```

and then browse to <http://127.0.0.1:5000/> (for the default layout),
or `http://127.0.0.1:5000/<layout_name>`

Following upgrades, check that `setup_token` contains all the API
tokens and any other secrets needed by the widgits, and re-run
`pip3 install -r requirements.txt` to update any Python dependencies.

Deployment on the TFC App Servers
=================================

As `tfc_prod`, clone the repository into `~tfc_prod/acp_lobby_screens`.
From that directory:

```
$ python3 -mvenv venv
$ source venv/bin/activate
$ pip3 install -r requirements.txt
$ sudo cp acp_lobby_screen_port_80.conf /etc/nginx/includes/
$ sudo service nginx restart
```

Create a file `lobby_screen.config` containing API tokens for National Rail
Enquiries ['Darwin LDB Webservice'](http://www.nationalrail.co.uk/100296.aspx)
and for The Met Office's [DataPoint service](https://www.metoffice.gov.uk/datapoint):

```
NRE_API_KEY = '...'
METOFFICE_KEY = '...'
```

Start the environment with

```
./run.sh
```

and browse to `http://<hostname>/lobby_screens/` (for the
default layout), or `http://<hostname>/lobby_screens\<layout_name>`

To arrange for the service to restart at boot time, add this line to
`tfc_prod`'s crontab:

```
@reboot /home/tfc_prod/icp_lobby_panel/run.sh
```

The environment logs to `/var/log/tfc_prod/lobby_screen`

Following upgrades, check that `lobby_screen.config` contains all the API
tokens and any other secrets needed by the widgits, and re-run
`pip3 install -r requirements.txt` to update any Python dependencies. If
the update has changed any template files, then `touch lobby_screen.py`
to trigger a reload of the Flask environment.
