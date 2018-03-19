# Raspberry Pi 'Kiosk' configuration

## Overview

The idea is to use a Raspberry Pi to boot and auto-display the browser accessing the 
pre-coded URL for the SmartPanel.

The URL will be of the for http://smartcambridge.org/smartpanel/<display_id>

## Config steps

### Disable screen blanking (i.e. no energy saving)

```
sudo apt install xscreensaver
```
Launch screensaver on desktop and select option to DISABLE screen saving

### Add autostart rules to avoid screensaving and launch browser
```
sudo nano ~/.config/lxsession/LXDE-pi/autostart
```

Add comment to `screensaver` launch command
```
#@screensaver -no-splash
```
Add additional 'no screensaving' commands
```
@xset s off
@xset -dpms
@xset s noblank
```
Add command to persude Chrome it had a clean exit and re-launch cromium-browser
```
@sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/Default/Preferences

@chromium-browser --noerrdialogs --incognito --kiosk http://smartcambridge.org/smartpanel/<display_id>
```

## Set boot behaviour to 'desktop' (not tty)
```
sudo raspi-config
```
(via desktop) GUI set 'boot behaviour' to 'desktop mode'

## Create a cron job to reboot the screen every morning

e.g. at 06:27 am

Don't forget the 'sudo' to ensure 'root' crontab, not pi user...
```
sudo crontab -e
```
```
27 06 * * * /sbin/shutdown -r now
```

