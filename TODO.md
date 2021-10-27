1. Statut - StatusService
2. Détection arrivée/départ - JoinLeaveService
3. Message de bienvenue/rôle par défaut
4. Détection appels - DiscordEventTransformer, CallNotificationService
5. (Détection réactions)
6. Ping/pong, merci capitaine - ThankYouCaptainService
7. Abonnement appels
8. Stream de musique : https://github.com/JamesKyburz/youtube-audio-stream
9. Watch together
10. Commandes pour toute cette merde - CommandsRegisterer
   1. Abonnements
   2. Image
   3. Say
   4. Statut


- moderators/owner
- polls
- generalize bot
- cache state?

What if 'CronJob' arrives before 'DbReady' (for activity status)? There should be a way to check that 'DbReady' was sent, when 'CronJob' arrives.
