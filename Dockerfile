FROM node:4-onbuild

ADD . /typescript_template

WORKDIR /typescript_template

RUN npm install
