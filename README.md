# api-examples
https://api2.timedoctor.com/

## web-app-usage report:

## Requirements

You need to install nodejs v12

### Installation
```bash
$ npm install
```
Create `.env` file in the root folder and add the following into it:
```
EMAIL={email}
PASSWORD={password}
```

### Usage
`npm run web-app-usage -- --group-name="Design" --this=day`
* `--group-name` is the group name
* `--this` is the date range, could be `day`, `week` or `month`
