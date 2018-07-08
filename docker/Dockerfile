FROM debian:stable

RUN apt-get update && apt-get install -y xauth xvfb libglib2.0-0 libnss3 libgconf-2-4 libfontconfig \
	libpangocairo-1.0-0 libxi6 libxcursor1 libxcomposite1 libasound2 libxtst6 libxrandr2 libxss1 libgtk-3-0

ADD Simpl.js /usr/lib/simpljs

EXPOSE 1080 8000

VOLUME /usr/var/simpljs

ENTRYPOINT ["/usr/lib/simpljs/launch.sh"]
