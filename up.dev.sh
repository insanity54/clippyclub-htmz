#!/bin/bash

# start dev cluster
cat <<EOF | ctlptl apply -f -
    apiVersion: ctlptl.dev/v1alpha1
    kind: Cluster
    product: minikube
    registry: ctlptl-registry
    kubernetesVersion: v1.28.3
EOF

# enable cluster addons
minikube addons enable volumesnapshots
minikube addons enable csi-hostpath-driver

# start tilt
tilt up