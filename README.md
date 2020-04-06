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

#### Web App Usage
`npm run web-app-usage -- --group-name="Design" --this=day`
* `--group-name` is the group name
* `--this` is the date range, could be `day`, `week` or `month`

#### User Status
`npm run user-status -- --date-range=this-day`
* `--user` is specific user id or comma-separated list of user IDs
* `--date-range` is the date range, could be `this-day`, `this-week` or `this-month`
