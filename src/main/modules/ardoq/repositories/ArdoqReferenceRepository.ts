import { ArdoqRelationship } from '../ArdoqRelationship';
import { ArdoqWorkspace } from '../ArdoqWorkspace';
import { BatchCreate, BatchUpdate } from '../batch/BatchModel';

import { AxiosInstance } from 'axios';

const { Logger } = require('@hmcts/nodejs-logging');

export type SearchReferenceResponse = {
  id: string;
  version: string | undefined;
};

export class ArdoqReferenceRepository {
  static readonly componentTypeLookup = new Map<ArdoqWorkspace, string>([
    [ArdoqWorkspace.ARDOQ_VCS_HOSTING_WORKSPACE, 'p1681283498700'],
    [ArdoqWorkspace.ARDOQ_CODE_REPOSITORY_WORKSPACE, 'p1681283498700'],
    [ArdoqWorkspace.ARDOQ_SOFTWARE_FRAMEWORKS_WORKSPACE, 'p1659003743296'],
  ]);

  constructor(private httpClient: AxiosInstance, private logger = Logger.getLogger('ArdoqReferenceRepository')) {}

  public async search(source: string, target: string): Promise<undefined | SearchReferenceResponse> {
    this.logger.debug('Calling GET /api/v2/references source:' + source + ' target:' + target);
    const searchResponse = await this.httpClient.get('/api/v2/references', {
      params: {
        source,
        target,
      },
      responseType: 'json',
    });

    if (searchResponse.status === 200 && searchResponse.data.values.length > 0) {
      return {
        id: searchResponse.data.values[0]._id,
        version: searchResponse.data.values[0].customFields?.version,
      };
    }
  }

  public getCreateOrUpdateModel(
    existingReference: SearchReferenceResponse | undefined,
    source: string,
    target: string,
    relationship: ArdoqRelationship,
    version?: string
  ): BatchCreate | BatchUpdate | undefined {
    if (!existingReference) {
      return {
        body: {
          source,
          target,
          type: relationship,
          customFields: version ? { version } : undefined,
        },
      } as BatchCreate;
    } else if (version && existingReference.version !== version) {
      return {
        id: existingReference.id,
        ifVersionMatch: 'latest',
        body: {
          source,
          target,
          type: relationship,
          customFields: { version },
        },
      } as BatchUpdate;
    }
  }
}
