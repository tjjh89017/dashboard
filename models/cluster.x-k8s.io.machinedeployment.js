import { CAPI } from '@/config/types';
import { escapeHtml } from '@/utils/string';
import { sortBy } from '@/utils/sort';
import SteveModel from '@/plugins/steve/steve-class';
import { exceptionToErrorsArray } from '~/utils/error';
import { handleConflict } from '~/plugins/steve/normalize';

export default class CapiMachineDeployment extends SteveModel {
  get cluster() {
    if ( !this.spec.clusterName ) {
      return null;
    }

    const clusterId = `${ this.metadata.namespace }/${ this.spec.clusterName }`;

    const cluster = this.$rootGetters['management/byId'](CAPI.RANCHER_CLUSTER, clusterId);

    return cluster;
  }

  get groupByLabel() {
    const name = this.cluster?.nameDisplay || this.spec.clusterName;

    return this.$rootGetters['i18n/t']('resourceTable.groupLabel.cluster', { name: escapeHtml(name) });
  }

  get groupByPoolLabel() {
    return `${ this.$rootGetters['i18n/t']('resourceTable.groupLabel.machinePool', { name: escapeHtml(this.nameDisplay) }) }`;
  }

  get groupByPoolShortLabel() {
    return `${ this.$rootGetters['i18n/t']('resourceTable.groupLabel.machinePool', { name: escapeHtml(this.nameDisplay) }) }`;
  }

  get templateType() {
    return this.spec.template.spec.infrastructureRef.kind ? `rke-machine.cattle.io.${ this.spec.template.spec.infrastructureRef.kind.toLowerCase() }` : null;
  }

  get template() {
    const ref = this.spec.template.spec.infrastructureRef;
    const id = `${ ref.namespace }/${ ref.name }`;
    const template = this.$rootGetters['management/byId'](this.templateType, id);

    return template;
  }

  get providerName() {
    return this.template?.nameDisplay;
  }

  get providerDisplay() {
    const provider = (this.template?.provider || '').toLowerCase();

    return this.$rootGetters['i18n/withFallback'](`cluster.provider."${ provider }"`, null, 'generic.unknown', true);
  }

  get providerLocation() {
    return this.template?.providerLocation || this.t('node.list.poolDescription.noLocation');
  }

  get providerSize() {
    return this.template?.providerSize || this.t('node.list.poolDescription.noSize');
  }

  get desired() {
    return this.spec?.replicas || 0;
  }

  get pending() {
    return Math.max(0, this.desired - (this.status?.replicas || 0));
  }

  get outdated() {
    return Math.max(0, (this.status?.replicas || 0) - (this.status?.updatedReplicas || 0));
  }

  get ready() {
    return Math.max(0, (this.status?.replicas || 0) - (this.status?.unavailableReplicas || 0));
  }

  get unavailable() {
    return this.status?.unavailableReplicas || 0;
  }

  scalePool(delta, save = true, depth = 0) {
    const machineConfigName = this.template.metadata.annotations['rke.cattle.io/cloned-from-name'];
    const machinePools = this.cluster.spec.rkeConfig.machinePools;

    const clustersMachinePool = machinePools.find(pool => pool.machineConfigRef.name === machineConfigName);

    if (!clustersMachinePool) {
      return;
    }

    const initialValue = this.cluster.toJSON();

    clustersMachinePool.quantity += delta;

    if ( !save ) {
      return;
    }

    const value = this.cluster;
    const liveModel = this.$rootGetters['management/byId'](CAPI.RANCHER_CLUSTER, this.cluster.id);

    if ( this.scaleTimer ) {
      clearTimeout(this.scaleTimer);
    }

    this.scaleTimer = setTimeout(() => {
      this.cluster.save().catch((err) => {
        let errors = exceptionToErrorsArray(err);

        if ( err.status === 409 && depth < 2 ) {
          const conflicts = handleConflict(initialValue, value, liveModel, this.$rootGetters);

          if ( conflicts === false ) {
            // It was automatically figured out, save again
            // (pass in the delta again as `clustersMachinePool.quantity` would have reset from the re-fetch done in `save`)
            return this.scalePool(delta, true, depth + 1);
          } else {
            errors = conflicts;
          }
        }

        this.$dispatch('growl/fromError', {
          title: 'Error scaling pool',
          err:   errors
        }, { root: true });
      });
    }, 1000);
  }

  get stateParts() {
    const out = [
      {
        label:     'Pending',
        color:     'bg-info',
        textColor: 'text-info',
        value:     this.pending,
        sort:      1,
      },
      {
        label:     'Outdated',
        color:     'bg-warning',
        textColor: 'text-warning',
        value:     this.outdated,
        sort:      2,
      },
      {
        label:     'Unavailable',
        color:     'bg-error',
        textColor: 'text-error',
        value:     this.unavailable,
        sort:      3,
      },
      {
        label:     'Ready',
        color:     'bg-success',
        textColor: 'text-success',
        value:     this.ready,
        sort:      4,
      },
    ].filter(x => x.value > 0);

    return sortBy(out, 'sort:desc');
  }
}
