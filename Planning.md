I want this to be an extension that grabs the download links to various simfiles and creates a convient zip for them.
Rethinking this to be a database of sorts that queries every source and lets me sort through and pick out which files I want.
So rather than an extension, its basically just bridge but for dtxmania.

This discord message has the list of creators (https://discord.com/channels/427808294485098507/821077464356225103/821078170806517762)
the main one I would want to scrape for data is ApprovedDTX cause they're the one I know best

database should probably be structured as following
Name - String
Artist - String
Difficulties - Array
source? - string
linkToDL - url
previewImage? - url


This kinda works but it is a little hard coded
I'll link to the ones that don't follow the strict format so I can figure out how to include them
#919 has two versions but only one dl link. The dl link is on the second diff div

https://approvedtx.blogspot.com/2022/12/dtxmania-fuzz-up-skin.html 
isn't a song post and needs to be considered

https://approvedtx.blogspot.com/2022/12/902-moment-of-my-life-full-version.html 
variable bpm, listed as 70-189

https://approvedtx.blogspot.com/2022/04/795-model-ft-ultimates.html
It will be ages until im good enough to plat this but this uses a slightly different format to acommodate each instrument,
I'll probably just ignore posts that don't follow the format

https://approvedtx.blogspot.com/2022/02/015-reversi-full-version-revised.html
their older posts tend to do this where there's a line for the source of the song which I would want to ignore somehow