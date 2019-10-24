#!/usr/bin/env node
import axios from 'axios';
import yargs from 'yargs';
import { from, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

require('dotenv').config();

class WebAppUsage {
  constructor() {
    this.options = yargs
      .usage('Usage: -n <group-name>')
      .option('n', {
        alias: 'group-name', describe: 'group name', type: 'string', demandOption: true,
      })
      .argv;

    this.api = axios.create({
      baseURL: 'https://api2.timedoctor.com',
    });
  }

  // login request
  login() {
    console.log('Logining ....');
    return this.api.post('/api/1.0/authorization/login', {
      deviceId: 'nodejs',
      email: process.env.USERNAME,
      password: process.env.PASSWORD,
    });
  }

  // get all groups request
  getAllGroups() {
    console.log('get all groups ....');
    return this.api.get('/api/1.0/tags', {
      params: {
        company: this.companyId,
        token: this.token,
      },
    });
  }

  // get users by group request
  getUsersByGroupId(groupId) {
    console.log('get all users ....');
    return this.api.get('/api/1.0/users', {
      params: {
        company: this.companyId,
        tag: groupId,
        detail: 'info',
        sort: 'name',
        'task-project-names': true,
        'filter[0][!role]': 'guest',
        'filter[0][show-on-reports]': 1,
        token: this.token,
      },
    });
  }

  handleRequest() {
    // login and get all groups
    const groups$ = from(this.login()).pipe(
      map((response) => response.data.data),
      switchMap((user) => {
        this.companyId = user.companies[0].id;
        this.token = user.token;
        return from(this.getAllGroups());
      }),
      catchError((val) => throwError(val.response ? val.response.data.message : val)),
    );

    // check if the group name exists and get the group's users;
    const users$ = groups$.pipe(
      switchMap((res) => {
        const groups = res.data.data;
        const selectedGroup = groups.find((group) => group.name === this.options['group-name']);
        if (!selectedGroup) {
          return throwError(`Group ${this.options['group-name']} doesn't exist`);
        }
        console.log('Getting all users for group: ', selectedGroup.id);
        return from(this.getUsersByGroupId(selectedGroup.id))
          .pipe(
            map((response) => response.data.data),
          );
      }),
    );

    const stats$ = users$.pipe(
      map((user) => user[0].name),
    );

    stats$.subscribe({
      next: (user) => {
        console.log('next!!!', user);
      },
      error: (val) => console.log(`Error: ${val}`),
    });
  }
}

const webAppUsage = new WebAppUsage();
webAppUsage.handleRequest();
