# OCE Rollout Guard

[English](README.en.md) · [Español](README.es.md)

Garde externe de déploiement pour OpenClaw Enterprise (OCE). Il crée un plan à partir de l'agent et de sa configuration, bloque le déploiement si leur état change, écrit une intention privée **avant** l'appel de déploiement, puis vérifie la révision exacte et une sonde indépendante. Il n'efface ni ne restaure automatiquement les révisions.

## Utilisation

Connectez d'abord le CLI occ à une installation de test. Copiez config.example.json vers un fichier privé dans .local/ et remplacez les identifiants. La commande probeCommand peut appeler la suite [oce-agent-conformance](https://github.com/gbesse/oce-agent-conformance) configurée pour une vraie sonde de modèle. Ne passez jamais de secret en argument de commande.

    node src/cli.js plan .local/config.private.json .local/plan.json
    node src/cli.js dispatch .local/plan.json .local/dispatch.json --apply
    node src/cli.js verify .local/dispatch.json .local/report.json
    npm test

dispatch crée .local/dispatch.json.intent avant l'appel OCC. Si la réponse du déploiement est perdue, le résultat est unknown : examinez les révisions et l'audit OCE avant toute nouvelle demande. verify ne marque pass que si le déploiement exact a réussi, si la révision est active, s'il n'y a pas d'avertissement et si probeCommand retourne un JSON avec status égal à pass. Sans sonde, le résultat reste incomplete. La confiance dans la provenance de la sonde appartient à l'opérateur.

L'[API OCE](https://docs-enterprise.openclaw.org/guides/topics/agent-revisions/) n'a pas d'opération publique de rollback. En cas d'échec, corrigez la configuration conservée dans votre gestion de source et déployez une nouvelle révision après examen. Les tests de ce dépôt utilisent un faux CLI ; aucune installation réelle n'a été vérifiée.

Codes de sortie : 0 réussite ou plan enregistré, 1 échec ou résultat incertain, 2 preuve incomplète. Licence MIT.
