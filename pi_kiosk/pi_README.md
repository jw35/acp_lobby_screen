# Raspberry Pi 'Kiosk' configuration

## Overview

The idea is to use a Raspberry Pi to boot and auto-display the browser accessing the 
pre-coded URL for the SmartPanel.

The URL will be of the for http://smartcambridge.org/smartpanel/<display_id>

## TV Config steps

Basically we need to persuade the TV to just display the 1920x1080 content from the Pi, no
overscan, no smoothing the pixels etc. By default, the TV will overscan, i.e. actually display
a smaller resolution image taken from the center of the content and you will see the edges of
intended content cut off. Unfortunately, getting the TV *not* to mess with the picture usually
involves a bit of trial-and-error. Any of these suggestions below might work.

### Set Pi desktop image to a 1920x1080 test image

First of all, download the 1920x1080_test.jpg image in this folder to the Pi, and set it as the
Pi desktop image by right-clicking the desktop and choosing 'Appearance'. Make sure you use the 
option 'Center' to place the test image in the center of the screen without scaling.

### Set the Pi screen resolution to 1920x1080

Click on the Application Menu (the Raspberry top-left of the destop), then Preferences, then
Raspberry Pi Configuration.

On the 'Resolution' option click the button 'Set Resolution' and select to use the 'Preferred
Monitor Settings'.

### Have the Pi desktop top taskbar auto-hide

Right-click the taskbar at the top of the screen.  Choose 'auto-hide' with a 2-pixel 'hidden
size'.  The taskbar should disappear but you can get it back by moving the mouse to the top
of the screen.

### Use TV remote to alter picture settings to remove overscanning

1. If possible, rename the HDMI input the Raspberry Pi is connected to (yes, I'm serious).
On Samsung TV's you can do this by clicking the 'Source' button which brings up a list of
HDMI inputs, and then if you hit the 'Tools' button you will get a 'Rename' option.  Rename the
input to "PC".
2. On the TV, go to 'Settings'..'Picture'..'Picture Mode' which defaults to 'Standard', and change it to
'Entertainment'.
3. In 'Settings'..'Picture'..'Picture Size' choose 16:9. Another option may be 'Fit Picture' which works,
but may be grayed-out as a result of using option 1 above (which is generally a good sign).

### Turn off TV power-saving modes

Just go into whatever TV 'Eco' or 'Timer' modes you can find and disable the auto-screen-blanking.

## Raspberry Pi System Config steps

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

