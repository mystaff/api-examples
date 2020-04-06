#!/usr/bin/env node

import axios from 'axios';
import yargs from 'yargs';
import { DateTime } from 'luxon';
import { dateRange, humanizeDuration, log } from '../utils/utils';

require('dotenv').config();

const PRODUCTIVITY_SCORES = {
  unrated: 0,
  unproductive: 2,
  neutral: 3,
  productive: 4,
};

class UserStatus {
  constructor() {
    this.options = yargs
      .usage('Usage: -u <user>')
      .option('u', {
        alias: 'user', describe: 'user ids, Comma-separated list of User IDs', type: 'string', demandOption: true,
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
      email: process.env.EMAIL,
      password: process.env.PASSWORD,
      totpCode: process.env.TWOFACODE,
    }).then(async (response) => {
      if (response.data.data.status === 'totpNeeded') {
        log('2FA code is required', true);
      }
      this.companyId = response.data.data.companies[0].id;
      this.companyTimezone = response.data.data.companies[0].companyTimezone;
      this.token = response.data.data.token;
      return true;
    }).catch((error) => {
      log(error, true);
    });
  }

  // get all users
  async getAllUsers() {
    log('get users info ...');
    return this.api.get('/api/1.0/users', {
      params: {
        company: this.companyId,
        user: this.options.user,
        detail: 'tags',
        self: 'include',
        'silent-details': 1,
        'task-project-names': true,
        'filter[0][show-on-reports]': 1,
        limit: 500,
        page: 0,
        token: this.token,
      },
    }).then((response) => response.data.data).catch((error) => {
      log(error.response.data.message, true);
    });
  }

  // get all users
  async getUsersWorklogs(userIds) {
    log('get all users worklogs ....');
    const { fromDate, toDate } = dateRange(this.companyTimezone, this.options.this);
    return this.api.get('/api/1.0/activity/worklog', {
      params: {
        company: this.companyId,
        user: userIds,
        'task-project-names': true,
        from: fromDate,
        to: toDate,
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
        limit: 200,
        sort: '_total',
        user: userId,
        token: this.token,
      },
    });
  }

  // map categories data with users
  mapUserCategories(category) {
    let rating;
    switch (category.score) {
      case PRODUCTIVITY_SCORES.unrated:
        rating = 'Unrated';
        break;
      case PRODUCTIVITY_SCORES.unproductive:
        rating = 'Unproductive';
        break;
      case PRODUCTIVITY_SCORES.neutral:
        rating = 'Neutral';
        break;
      default:
        rating = 'Productive';
    }

    return {
      name: category.name,
      rating,
      total: humanizeDuration(category.total),
      entity: category.entity === 2 ? 'app' : 'web',
    };
  }

  // get tracking time score by user id request
  async getUsersScoreRatio(userIds) {
    log(`get tracking time score for user: ${userIds} ....`);

    const { fromDate, toDate } = dateRange(this.companyTimezone, this.options.this);

    return this.api.get('/api/1.0/stats/score-ratio', {
      params: {
        company: this.companyId,
        from: fromDate,
        to: toDate,
        limit: 200,
        realtime: 0,
        sort: '_total',
        'group-by': 'user',
        user: userIds,
        token: this.token,
      },
    }).then((response) => response.data.data.users).catch((error) => {
      log(error.response.data.message, true);
    });
  }


  async processRequest() {
    // login
    const isLoggedIn = await this.login();
    if (isLoggedIn) {
      // get users ingo
      const users = await this.getAllUsers();

      const requests = [];
      const data = [];
      const userids = [];

      // loop for users
      users.forEach((user) => {
        // set the default values for each user
        data.push({
          userId: user.id,
          name: user.name,
          startTime: null,
          endTime: null,
          totalTime: 0,
          totalProductiveTime: 0,
          totalUnProductiveTime: 0,
          totalNeutralTime: 0,
          categories: [],
        });
        userids.push(user.id);
        // get categories data for users
        requests.push(this.getCategoryTotalByUserId(user.id));
      });

      // get users worklogs
      const usersWorklogs = await this.getUsersWorklogs(userids.join(','));

      usersWorklogs.forEach((userWorklogs, index) => {
        const userInfo = data[index];
        userWorklogs.forEach((worklog, i) => {
          if (i === 0) {
            // set user's tracking start time
            userInfo.startTime = DateTime.fromISO(worklog.start).setZone(this.companyTimezone).toISO();
          }

          if (i === (userWorklogs.length - 1)) {
            // set user's tracking end time
            userInfo.endTime = DateTime.fromISO(worklog.start).plus({ seconds: worklog.time }).setZone(this.companyTimezone).toISO();
          }
        });
      });

      // get users tracking time score
      const usersScoreRatio = await this.getUsersScoreRatio(userids.join(','));
      usersScoreRatio.forEach((userScoreRatio) => {
        const userIndex = data.findIndex((u) => u.userId === userScoreRatio.userId);
        const userInfo = data[userIndex];
        userInfo.totalTime = humanizeDuration(userScoreRatio.total);
        userInfo.totalProductiveTime = humanizeDuration(userScoreRatio[PRODUCTIVITY_SCORES.productive]);
        userInfo.totalUnProductiveTime = humanizeDuration(userScoreRatio[PRODUCTIVITY_SCORES.unproductive]);
        userInfo.totalNeutralTime = humanizeDuration(userScoreRatio[PRODUCTIVITY_SCORES.neutral]);
      });

      // performing multiple concurrent requests to get tracking time categories for each user
      axios.all(requests).then((responses) => {
        responses.forEach((res) => {
          res.data.data.category.forEach((category) => {
            const userIndex = data.findIndex((u) => u.userId === category.userId[0]);
            if (userIndex > -1) {
              const userInfo = data[userIndex];
              userInfo.categories.push(this.mapUserCategories(category, userInfo));
            }
          });
        });

        // return the final data;
        log(data);
      });
    }
  }
}

const userStatus = new UserStatus();
userStatus.processRequest();
