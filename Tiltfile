k8s_yaml(helm(
    './charts/clipstrclub',
    values=['./charts/clipstrclub/values-dev.yaml'],
))

docker_build(
    'clipstrclub/web', 
    '.',
    live_update=[
        sync('./src', '/app')
    ]
)

k8s_resource(
    'web-pod',
    port_forwards=['4000']
)
