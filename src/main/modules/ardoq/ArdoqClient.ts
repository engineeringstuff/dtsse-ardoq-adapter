import { ArdoqComponentCreatedStatus } from './ArdoqComponentCreatedStatus';
import { ArdoqRelationship } from './ArdoqRelationship';
import { ArdoqWorkspace } from './ArdoqWorkspace';
import { Dependency } from './Dependency';

import { AxiosInstance } from 'axios';
import config from 'config';

const { Logger } = require('@hmcts/nodejs-logging');

export class ArdoqClient {
  readonly componentTypeLookup = new Map<ArdoqWorkspace, string>([
    [ArdoqWorkspace.ARDOQ_VCS_HOSTING_WORKSPACE, 'p1681283498700'],
    [ArdoqWorkspace.ARDOQ_CODE_REPOSITORY_WORKSPACE, 'p1681283498700'],
    [ArdoqWorkspace.ARDOQ_SOFTWARE_FRAMEWORKS_WORKSPACE, 'p1659003743296'],
  ]);

  constructor(
    private httpClient: AxiosInstance,
    private cache: Map<string, Dependency> = new Map<string, Dependency>(),
    private logger = Logger.getLogger('ArdoqClient')
  ) {}

  private cacheResult(d: Dependency) {
    this.cache.set(d.name, d);
  }

  private isCached(d: Dependency): boolean {
    const found = this.cache.get(d.name);
    return found ? found.equals(d) : false;
  }

  private searchForComponent(componentName: string, workspace: ArdoqWorkspace) {
    return this.httpClient.get('/api/v2/components', {
      params: {
        rootWorkspace: config.get(workspace),
        name: componentName,
      },
      responseType: 'json',
    });
  }

  private createComponent(componentName: string, workspace: ArdoqWorkspace) {
    return this.httpClient.post(
      '/api/v2/components',
      {
        rootWorkspace: config.get(workspace),
        name: componentName,
        typeId: this.componentTypeLookup.get(workspace),
      },
      {
        params: {
          rootWorkspace: config.get(workspace),
          name: componentName,
          typeId: this.componentTypeLookup.get(workspace),
        },
        responseType: 'json',
      }
    );
  }

  private async createOrGetComponent(name: string, workspace: ArdoqWorkspace): Promise<string | null> {
    const searchRes = await this.searchForComponent(name, workspace);
    if (searchRes.status === 200 && searchRes.data.values.length > 0) {
      this.logger.debug('Found component: ' + name);
      return searchRes.data.values[0]._id;
    }
    const createRes = await this.createComponent(name, workspace);
    if (createRes.status !== 201) {
      this.logger.error('Unable to create component: ' + name);
      return null;
    }
    this.logger.debug('Component created: ' + name);
    return createRes.data._id;
  }

  public createVcsHostingComponent(name: string): Promise<string | null> {
    return this.createOrGetComponent(name, ArdoqWorkspace.ARDOQ_VCS_HOSTING_WORKSPACE);
  }

  public createCodeRepoComponent(name: string): Promise<string | null> {
    return this.createOrGetComponent(name, ArdoqWorkspace.ARDOQ_CODE_REPOSITORY_WORKSPACE);
  }

  private async searchForReference(
    source: string,
    target: string
  ): Promise<undefined | { id: string; version?: string | undefined }> {
    return this.httpClient
      .get('/api/v2/references', {
        params: {
          source,
          target,
        },
        responseType: 'json',
      })
      .then(res => {
        if (res.status === 200 && res.data.values.length > 0) {
          return {
            id: res.data.values[0]._id,
            version: res.data.values[0].customFields?.version,
          };
        }
      });
  }

  private updateReferenceVersion(id: string, version: string): Promise<void> {
    return this.httpClient.patch(
      `/api/v2/references/${id}?ifVersionMatch=latest`,
      {
        customFields: {
          version,
        },
      },
      {
        responseType: 'json',
      }
    );
  }

  private createReference(
    source: string,
    target: string,
    relationship: ArdoqRelationship,
    version?: string
  ): Promise<unknown> {
    const data = {
      source,
      target,
      type: relationship,
      customFields: version ? { version } : undefined,
    };

    return this.httpClient.post('/api/v2/references', data, {
      responseType: 'json',
    });
  }

  public async referenceRequest(
    source: string,
    target: string,
    relationship: ArdoqRelationship,
    version?: string
  ): Promise<void> {
    const existingReference = await this.searchForReference(source, target);
    if (existingReference) {
      if (version && existingReference.version !== version) {
        await this.updateReferenceVersion(existingReference.id, version);
      }
      return;
    }
    await this.createReference(source, target, relationship, version);
    return;
  }

  public async updateDep(d: Dependency): Promise<[ArdoqComponentCreatedStatus, string | null]> {
    if (this.isCached(d)) {
      this.logger.debug('Found cached result for: ' + d.name + ' - ' + d.componentId);
      return [ArdoqComponentCreatedStatus.EXISTING, d.componentId];
    }

    const searchResponse = await this.searchForComponent(d.name, ArdoqWorkspace.ARDOQ_SOFTWARE_FRAMEWORKS_WORKSPACE);
    if (searchResponse.status === 200 && searchResponse.data.values.length > 0) {
      d.componentId = searchResponse.data.values[0]._id;
      this.logger.debug('Found component: ' + d.name + ' - ' + d.componentId);
      this.cacheResult(d);
      return [ArdoqComponentCreatedStatus.EXISTING, d.componentId];
    }

    // create a new object
    const createResponse = await this.createComponent(d.name, ArdoqWorkspace.ARDOQ_SOFTWARE_FRAMEWORKS_WORKSPACE);
    if (createResponse.status === 201) {
      d.componentId = createResponse.data._id;
      this.logger.debug('Created component: ' + d.name + ' - ' + d.componentId);
      this.cacheResult(d);
      return [ArdoqComponentCreatedStatus.CREATED, d.componentId];
    }
    return [ArdoqComponentCreatedStatus.ERROR, null];
  }
}
