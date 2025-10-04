#!/bin/zsh
heroku container:push web --app=tmi-ux
heroku container:release web --app=tmi-ux
