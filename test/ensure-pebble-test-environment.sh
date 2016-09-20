# For use on CircleCI
#
# https://developer.pebble.com/sdk/install/linux/
# http://cathaines.com/2016/03/building-pebble-apps-with-travis-ci/

set -x
set -e

PEBBLE_TOOL_PATH=pebble-sdk-$PEBBLE_TOOL-linux64
IMAGEMAGICK_PATH=ImageMagick-7.0.3-0

######## Python testing dependencies

pip install -r ~/urchin-cgm/requirements.txt

######## Pebble CLI tool

if [ ! -e ~/pebble-dev/$PEBBLE_TOOL_PATH ]; then
  mkdir -p ~/pebble-dev
  cd ~/pebble-dev
  wget https://s3.amazonaws.com/assets.getpebble.com/pebble-tool/$PEBBLE_TOOL_PATH.tar.bz2
  tar -jxf $PEBBLE_TOOL_PATH.tar.bz2

  mkdir -p ~/.pebble-sdk
  touch ~/.pebble-sdk/NO_TRACKING

  cd ~/pebble-dev/$PEBBLE_TOOL_PATH
  virtualenv --no-site-packages .env
  source .env/bin/activate
  pip install -r requirements.txt
  deactivate

  echo 'export PATH=~/pebble-dev/'$PEBBLE_TOOL_PATH'/bin:$PATH' > ~/pebble-dev/path.sh
fi

######## Pebble emulator

sudo apt-get install libsdl1.2debian libfdt1 libpixman-1-0

######## Pebble SDK

. ~/pebble-dev/path.sh
# Ignore bad return code when SDK is already installed
(yes | pebble sdk install $PEBBLE_SDK) || true
pebble sdk activate $PEBBLE_SDK

######## ImageMagick

if [ ! -e ~/imagemagick ]; then
  # http://www.imagemagick.org/script/install-source.php
  mkdir ~/imagemagick
  cd ~/imagemagick
  wget http://www.imagemagick.org/download/$IMAGEMAGICK_PATH.tar.gz
  tar -xvzf $IMAGEMAGICK_PATH.tar.gz
  cd $IMAGEMAGICK_PATH
  ./configure
  make
fi
cd ~/imagemagick/$IMAGEMAGICK_PATH
sudo make install
sudo ldconfig /usr/local/lib
(convert logo: logo.gif && rm logo.gif) || { echo "ImageMagick install failed"; exit 1; }
