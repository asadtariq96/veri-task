## How to run

1. clone the repo
2. `npm install`
3. `docker-compose up`
4. `npm run start`

### Sample requests

1. Load all questions between 01-03-22 and 31-03-22 having the tags `nodejs, mongo and express`

```
curl --location --request POST 'localhost:3000/load?from=1646092800&to=1648684800&tags=nodejs;mongo;express'
```

2. Load all questions between 01-04-22 and 07-04-22

```
curl --location --request POST 'localhost:3000/load?from=1648771200&to=1649289600'
```

3. Get stats

```
curl --location --request GET 'localhost:3000/stats?k=50'
```

## Possible improvements

Following are some of the improvements which can be made, but were not implemented due to lack of time.

1. Use ts instead of js for static type safety
2. Organize the project in a proper file structure
3. Validate all API endpoints
4. Error handling for `got.get()`, `sql.query()` etc
5. Remove redundant insertion queries, filter data before bulk insert

## Database Diagram
![image](https://user-images.githubusercontent.com/18158879/162379760-c7c0cb97-3ec2-4129-b0e6-824bded7d190.png)


