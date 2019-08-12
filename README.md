# trembita-js

[![Build Status](https://travis-ci.com/oleg-koval/trembita.svg?branch=master)](https://travis-ci.com/oleg-koval/trembita)
[![Coverage Status](https://coveralls.io/repos/github/oleg-koval/trembita/badge.svg?branch=master)](https://coveralls.io/github/oleg-koval/trembita?branch=master)
[![JavaScript Style Guide: Good Parts](https://img.shields.io/badge/code%20style-goodparts-brightgreen.svg?style=flat)](https://github.com/dwyl/goodparts "JavaScript The Good Parts")

> Request wrapper core for consuming third party services

Whenever you need to communicate with third party API to get or save data from
own codebase, you would have to perform a set of common steps such as login,
query, etc. Trembita.js is doing the same by abstracting the innards of the
actual REST calls to third-party API and exposing only the developer relevant
details. Trembita.js supports plugins which are API connectors that are exposing
methods for API communication. Each plugin is describing another third-party
service. It performs these commonly used functions - creates requests, parses
responses, handles errors etc.

The goal of this module is not only to provide you with a simple interface but
the implementation of commonly used tools out of the box. This is a core module
to reuse with plugins each for a different third-party service.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#license)

## Install

Using npm:

```
npm install trembita
```

Using yarn:

```
yarn add trembita
```

## Usage

Trembita is not supposed to be used directly, rather than to develop plugins.

In order you can use a third party service by implementing your plugin, make
sure you fill the next requeriments:

- Extend Trembita module.
- Construct the plugin by implementing the properties inherited from trembita
  module.
- Define the methods that contains the logic that expose third party library
  logic you want to use.

One example of usage would be:

```js
const clientOptions = {
  headers: {
    header1: 'xxx',
    header2: 'yyy'
  },
  endpoint: 'http://serviceapi.com'
};

const MyAPIClient = class MyAPIClient extends Trembita {
  constructor(options) {
    super(...arguments);

    this.getData = paramsQueryString => {
      const params = {
        url: `api/path/`,
        qs: paramsQueryString,
        expectedCodes: [200, 401, 403, 404],
        headers: {
          header1: this.header1,
          header2: this.header2
        }
      };
      return this.request(params);
    };
  }
};

const client = new MyAPIClient(clientOptions);
```

## Contribute

See [the contribute file](CONTRIBUTING.md)!

## License

MIT © 2018
