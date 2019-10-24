#!/usr/bin/env node

import axios from 'axios';
import { combineLatest, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import yargs from 'yargs';
import { dateRange, humanizeDuration, log } from '../utils/utils';

require('dotenv').config();

class WebAppUsage {
  constructor() {
    this.options = yargs
      .usage('Usage: -g <group-name>')
      .option('g', {
        alias: 'group-name', describe: 'group name', type: 'string', demandOption: true,
      })
      .option('t', {
        alias: 'this', describe: 'date range', type: 'string', default: 'day',
      })
      .argv;

    this.api = axios.create({
      baseURL: 'https://api2.timedoctor.com',
    });
  }

  // login request
  login() {
    log('logging in ....', 'green');
    return this.api.post('/api/1.0/authorization/login', {
      deviceId: 'nodejs',
      email: process.env.USERNAME,
      password: process.env.PASSWORD,
    });
  }

  // get all groups request
  getAllGroups() {
    log('get all groups ....', 'green');
    return this.api.get('/api/1.0/tags', {
      params: {
        company: this.companyId,
        token: this.token,
      },
    });
  }

  // get users by group request
  getUsersByGroupId(groupId) {
    log(`get all users for group: ${groupId} ....`, 'green');
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

  // get get category total by user id request
  getCategoryTotalByUserId(userId) {
    log(`get all categories for user: ${userId} ....`, 'green');
    const { fromDate, toDate } = dateRange(this.companyTimezone, this.options.this);
    return this.api.get('/api/1.0/stats/category-total', {
      params: {
        company: this.companyId,
        fields: 'entity,name,score,userId',
        'filter[total]': '60_',
        from: fromDate,
        to: toDate,
        limit: 400,
        sort: '_total',
        user: userId,
        token: this.token,
      },
    });
  }

  // map categories data with users
  mapUserCategories(category, user) {
    const data = {};
    data.employee = user.name;
    data.activityTracked = category.entity === 2 ? 'app' : 'web';
    data.name = category.name;
    switch (true) {
      case category.score <= 0:
        data.rating = 'Unrated';
        break;
      case category.score > 0 && category.score <= 2:
        data.rating = 'Unproductive';
        break;
      case category.score > 2 && category.score <= 3:
        data.rating = 'Neutral';
        break;
      default:
        data.rating = 'Productive';
    }
    data.timeWorked = humanizeDuration(category.total);
    data.totalTimeDecimal = (category.total / 60 / 60);
    data.totalTimeMinutes = Math.floor(category.total / 60);
    return data;
  }

  processRequest() {
    // login and get all groups
    const groups$ = from(this.login()).pipe(
      map((response) => response.data.data),
      switchMap((user) => {
        this.companyId = user.companies[0].id;
        this.companyTimezone = user.companies[0].timezone;
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
        return from(this.getUsersByGroupId(selectedGroup.id))
          .pipe(
            map((response) => response.data.data),
          );
      }),
    );

    // get categories data for users
    const stats$ = users$.pipe(
      switchMap((users) => {
        const requests = [];
        users.forEach((user) => {
          requests.push(this.getCategoryTotalByUserId(user.id));
        });
        return combineLatest(requests).pipe(
          map((responses) => {
            const data = [];
            responses.forEach((res) => {
              const userCategory = res.data.data.category.map((category) => {
                const user = users.find((u) => u.id === category.userId[0]);
                return this.mapUserCategories(category, user);
              });
              data.push(...userCategory);
            });
            return data;
          }),
        );
      }),
    );

    stats$.subscribe({
      next: (stats) => {
        log(stats);
      },
      error: (val) => {
        log(`Error: ${val}`, 'red');
        process.exit();
      },
    });
  }
}

const webAppUsage = new WebAppUsage();
webAppUsage.processRequest();
