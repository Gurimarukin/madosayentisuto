1. Détection appels - DiscordEventTransformer, CallNotificationService
2. (Détection réactions)
3. Ping/pong, merci capitaine - ThankYouCaptainService
4. Abonnement appels
5. Stream de musique : https://github.com/JamesKyburz/youtube-audio-stream
6. Commandes pour toute cette merde - CommandsRegisterer
   1. Abonnements
   2. Image
   3. Say
   4. Statut

- ensure indexes: unsubscribe when done

1. Watch together -> c mor


---

1. Statut - StatusService
2. Détection arrivée/départ - JoinLeaveService


- moderators/owner
- polls
- generalize bot
- cache state?

What if 'CronJob' arrives before 'DbReady' (for activity status)? There should be a way to check that 'DbReady' was sent, when 'CronJob' arrives.
