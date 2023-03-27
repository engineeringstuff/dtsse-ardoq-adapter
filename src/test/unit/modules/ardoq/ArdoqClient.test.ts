import axios from 'axios';
import { jest } from '@jest/globals';
import { describe, expect, it } from '@jest/globals';

import { ArdoqClient } from '../../../../main/modules/ardoq/ArdoqClient';
import { Dependency } from '../../../../main/modules/ardoq/Dependency';
import { ArdoqComponentCreatedStatus } from '../../../../main/modules/ardoq/ArdoqComponentCreatedStatus';
import { PropertiesVolume } from '../../../../main/modules/properties-volume';
import { app } from '../../../../main/app';

jest.mock('axios');

describe('ArdoqClient', () => {
  new PropertiesVolume().enableFor(app);

  const mockedAxios = axios as jest.Mocked<typeof axios>;
  // @ts-ignore
  mockedAxios.get.mockImplementation((url: string, config: object) => {
    // @ts-ignore
    const paramName = config.params.name;
    if (paramName === 'hot-tech') {
      return Promise.resolve({
        status: 200,
        data: '',
      });
    }
    if (paramName === '@!££$%^') {
      return Promise.resolve({
        status: 500,
        data: '',
      });
    }
    if (paramName === 'dtsse-ardoq-adapter') {
      return Promise.resolve({
        status: 404,
        data: '',
      });
    }
    if (paramName === 'github.com/hmcts') {
      return Promise.resolve({
        status: 200,
        data: [{ id: '5678' }],
      });
    }
    if (paramName === 'github.com/blah') {
      return Promise.resolve({
        status: 500,
        data: '',
      });
    }

    return Promise.resolve({
      status: 200,
      data: '[literally anything right now]',
    });
  });
  // @ts-ignore
  mockedAxios.post.mockImplementation((url: string, data: object, config: object) => {
    // @ts-ignore
    const paramName = config.params.name;
    if (paramName === 'hot-tech') {
      return Promise.resolve({
        status: 201,
      });
    }
    if (paramName === 'dtsse-ardoq-adapter') {
      return Promise.resolve({
        status: 201,
        data: {
          id: '1234',
        },
      });
    }
    return Promise.resolve({
      status: 500,
    });
  });

  const cache = new Map<string, Dependency>();

  it('Returns a CREATED response', () => {
    const client = new ArdoqClient(mockedAxios, cache);
    client.updateDep(new Dependency('hot-tech', '1.1.1')).then(result => {
      expect(result[0]).toEqual(ArdoqComponentCreatedStatus.CREATED);
    });
  });

  it('Returns an ERROR response', () => {
    const client = new ArdoqClient(mockedAxios, cache);
    client.updateDep(new Dependency('@!££$%^', '1.1.1')).then(result => {
      expect(result[0]).toEqual(ArdoqComponentCreatedStatus.ERROR);
    });
  });

  it('Returns an EXISTING response', () => {
    const client = new ArdoqClient(mockedAxios, cache);
    client.updateDep(new Dependency('hot-tech', '2.2.2')).then(result => {
      expect(result[0]).toEqual(ArdoqComponentCreatedStatus.EXISTING);

      // should now use a cached result
      client.updateDep(new Dependency('hot-tech', '2.2.2')).then(result => {
        expect(result[0]).toEqual(ArdoqComponentCreatedStatus.EXISTING);
      });
    });
  });

  it('createCodeRepoComponent creates', () => {
    const client = new ArdoqClient(mockedAxios, cache);
    client.createCodeRepoComponent('dtsse-ardoq-adapter').then(result => {
      expect(result).toEqual('1234');
    });
  });

  it('createVcsHostingComponent exists', () => {
    const client = new ArdoqClient(mockedAxios, cache);
    client.createCodeRepoComponent('github.com/hmcts').then(result => {
      expect(result).toEqual('5678');
    });
  });

  it('createVcsHostingComponent err', () => {
    const client = new ArdoqClient(mockedAxios, cache);
    client.createCodeRepoComponent('github.com/blah').then(result => {
      expect(result).toEqual(null);
    });
  });
});
