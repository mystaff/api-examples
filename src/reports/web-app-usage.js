#!/usr/bin/env node

import axios from 'axios';
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
  async login() {
    log('logging in ....');
    return this.api.post('/api/1.0/authorization/login', {
      deviceId: 'nodejs',
      email: process.env.USERNAME,
      password: process.env.PASSWORD,
    }).then(async (response) => {
      this.companyId = response.data.data.companies[0].id;
      this.companyTimezone = response.data.data.companies[0].timezone;
      this.token = response.data.data.token;
      return true;
    }).catch((error) => {
      log(error.response.data.message, true);
    });
  }

  // get all groups request
  async getAllGroups() {
    log('get all groups ....');
    return this.api.get('/api/1.0/tags', {
      params: {
        company: this.companyId,
        token: this.token,
      },
    }).then(async (response) => {
      const groups = response.data.data;
      const selectedGroup = groups.find((group) => group.name === this.options['group-name']);
      if (!selectedGroup) {
        throw (new Error(`Group ${this.options['group-name']} doesn't exist`));
      }
      return selectedGroup;
    }).catch((error) => {
      log(error.response ? error.response.data.message : error, true);
    });
  }

  // get users by group request
  async getUsersByGroupId(groupId) {
    log(`get all users for group: ${groupId} ....`);
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
    }).then((response) => response.data.data).catch((error) => {
      log(error.response.data.message, true);
    });
  }

  // get get category total by user id request
  async getCategoryTotalByUserId(userId) {
    log(`get all categories for user: ${userId} ....`);

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

  async processRequest() {
    // login and get all groups
    const isLoggedIn = await this.login();
    if (isLoggedIn) {
      // check if the group name exists and get the group's users;
      const selectedGroup = await this.getAllGroups();
      const users = await this.getUsersByGroupId(selectedGroup.id);

      // get categories data for users
      const requests = [];
      users.forEach((user) => {
        requests.push(this.getCategoryTotalByUserId(user.id));
      });

      // performing multiple concurrent requests
      axios.all(requests).then((responses) => {
        const data = [];
        responses.forEach((res) => {
          const userCategory = res.data.data.category.map((category) => {
            const user = users.find((u) => u.id === category.userId[0]);
            return this.mapUserCategories(category, user);
          });
          data.push(...userCategory);
        });
        // return the final data;
        log(data);
      });
    }
  }
}

const webAppUsage = new WebAppUsage();
webAppUsage.processRequest();
