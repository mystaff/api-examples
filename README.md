# api-examples

## web-app-usage report:
First create .env file in the root folder and add the following into it:
```
USERNAME={email}
PASSWORD={password}
```

Then run the following command line:

`npm run web-app-usage -- --group-name="Design" --this=day`
* `--group-name` is the group name
* `--this` is the date range, could be `day`, `week` or `month`