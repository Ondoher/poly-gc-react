# Polylith Game Center

## First time Setup
### Start
* Clone the repo
* run `npm install`


### Running
To run in developer mode be sure to set the environment variable NODE_ENV to
"dev".

To start the application use this command from the root of the source:
```shell
npm run dev
```
This will launch two windows, one that will build the app and one that will
run a webserver to serve it through https on port 443.

When both processes have completed, in your browser go to https://localhost/gc.
You will get a certificate error, just proceed anyway.

## Development
These commands can be used during development

**dev**
```shell
npm run dev
```
Run this command to launch two new windows one that builds the code and watches
for changes, and one that serves the application and watches for changes to
the server code

**dev:watch**
```shell
npm run dev:watch
```
This will build the source and watch it for changes

**dev:serve**
```shell
npm run dev:server
```

This serve the application and watch the server source for changes

**test**
```shell
npm test
```

Run this command to launch the unit tests. This will open two new windows, one
that will build the tests and watch the source for changes and rebuild. And
the other the karma test runner that runs those built tests. Karma is setup to
monitor the tests for changes and run them again.


**karma**
```shell
npm run karma
```
Run this command to relaunch the karma test runner. It does not open a new
window.

**dev:tests**
```shell
npm run dev:tests
```

Run this command to build the tests and watch for changes
