const { Bot, session, InlineKeyboard, File, InputMediaPhoto, sendMediaGroup} = require("grammy");
const { conversations, createConversation } = require("@grammyjs/conversations");
const { ApolloClient, InMemoryCache, gql } = require('@apollo/client');
const { id } = require("ethers/lib/utils.js");
require('dotenv').config();

const fetch = require('node-fetch');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Bot(BOT_TOKEN); 

const web_link = 'https://master--lambent-caramel-2d48f5.netlify.app/';

// THIS IS FOR THE LENS API
const APIURL = 'https://api.lens.dev/';
const apolloClient= new ApolloClient({uri: APIURL, cache: new InMemoryCache(),})

let profileLink = {};
let walletLink = {};
let currentId = {};
let defaultId = {};

bot.command('start', (ctx) => {
  const chatId = ctx.chat.id;
  if (profileLink[chatId] !== undefined) {
    ctx.reply(`<code>Accessing Default Profile...</code>`, {
      parse_mode: "HTML",
    });
    ctx.reply(`Welcome back <code>${profileLink[chatId]}</code>!🙋‍♂️`, {
      parse_mode: "HTML",
    })
    .then(() => {
      displayDefaultProfile(ctx, walletLink[chatId]);
    });
    sendMessageToServer('Hey new User');
  } else {
    ctx.reply(`Hello stranger!🙋‍♂️ \nWelcome to Nabi Protocol🦋! Please Connect Your Wallet down below!`, 
    {
      reply_markup: {
        keyboard: [
          [
            {
              text: 'Connect Your Wallet Here!',
              web_app: { url: web_link },
            },
          ],
        ],
      },
    });
    sendMessageToServer('Hey new User');
  }
});

async function sendMessageToServer(message) {
  try {
    const response = await fetch('https://master--lambent-caramel-2d48f5.netlify.app/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    console.log('Message sent to server');
  } catch (error) {
    console.error('Error:', error);
  }
}// this does not work

async function getDefaultProfile(ctx, address) {
  const chatId = ctx.chat.id;
  const query = `
  query DefaultProfile {
    defaultProfile(request: { ethereumAddress: "${address}"}) {
      id
      name
      bio
      isDefault
      attributes {
        displayType
        traitType
        key
        value
      }
      followNftAddress
      metadata
      handle
      picture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          chainId
          verified
        }
        ... on MediaSet {
          original {
            url
            mimeType
          }
        }
      }
      coverPicture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          chainId
          verified
        }
        ... on MediaSet {
          original {
            url
            mimeType
          }
        }
      }
      ownedBy
      dispatcher {
        address
        canUseRelay
      }
      stats {
        totalFollowers
        totalFollowing
        totalPosts
        totalComments
        totalMirrors
        totalPublications
        totalCollects
      }
      followModule {
        ... on FeeFollowModuleSettings {
          type
          contractAddress
          amount {
            asset {
              name
              symbol
              decimals
              address
            }
            value
          }
          recipient
        }
        ... on ProfileFollowModuleSettings {
        type
        }
        ... on RevertFollowModuleSettings {
        type
        }
      }
    }
  }
  `;
  try {
    const response = await apolloClient.query({
      query: gql(query),
    });
    console.log('Lens example data: ', response);

    const profile = response.data.defaultProfile;

    if (!profile) {
      await ctx.reply(`Checking Database...`);
      return [false, null];
    }

    const name = profile.name;
    const id = profile.id;
    const bio = profile.bio;
    const handle = profile.handle;
    const metadata = profile.metadata;
    const pictureLink = profile.picture ? convertIpfsToCloudflare(profile.picture.original.url) : undefined;
    const followers = profile.stats.totalFollowers;
    const following = profile.stats.totalFollowing;
    const posts = profile.stats.totalPosts;

    profileLink[chatId] = name;

    const message = `<b>${name}</b>     <code>${handle}</code>\n\n<i>Bio: ${bio}</i>\n\nFollowers:<b>${followers}</b>\nFollowing:<b>${following}</b>\nPosts:<b>${posts}</b>\n`;

    console.log(message, metadata, pictureLink)
    return [true, message, metadata, pictureLink, id];
  }
  catch (error) {
    console.error(error);
    await ctx.reply(`😱 Error: ${error.message}`);
    return [false, null];
  }
}

async function displayDefaultProfile(ctx, address) {
  const chatId = ctx.chat.id;
  try {
    const [profileExist, message, metadata, pictureLink, id] = await getDefaultProfile(ctx, address);
    currentId[chatId] = id;
    defaultId[chatId] = id;

    if (!profileExist) {
      const menu = new InlineKeyboard().url("Click here to buy a Lens Profile!", `https://opensea.io/collection/lens-protocol-profiles`);
      await ctx.reply(`Your connected wallet does not own a Lens Profile with this ID!`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
      return;
    }
    
    if (!pictureLink) {
      const menu = new InlineKeyboard()
        .text("My Other Profiles", `all_profiles:${address}`)
        .text("Followers", `view_followers:${id}`)
        .row()
        .text("Following", `view_following:${walletLink[chatId]}`)
        .text("My Posts", `see_post:${id}`)
        .row()
        .text("Search Profile", `search_profile`)
        .text("Search Post", `search_post`)
        .row()
        .text("Explore Posts", `explore_options`)
        ;
      await ctx.reply(`You do not have a Profile Picture! \n\n ${message}`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
      return;
    }
    
    const menu = new InlineKeyboard()
      .text("My Other Profiles", `all_profiles:${walletLink[chatId]}`)
      .text("Followers", `view_followers:${id}`)
      .row()
      .text("Following", `view_following:${walletLink[chatId]}`)
      .text("My Posts", `see_post:${id}`)
      .row()
      .text("Explore Posts", `explore_options`)
      .text("Search Profile", `search_profile`)
      .text("Search Post", `search_post`)
      ;
    await ctx.replyWithPhoto(`${pictureLink}`, {
      caption: `${message}`,
      reply_markup: menu,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error(error);
    if (
      error.message.includes("Bad Request: wrong file identifier/HTTP URL specified") ||
      error.message.includes("TypeError: Cannot read properties of undefined (reading 'url')")
    ) {
      const [profileExist, message, metadata, pictureLink, id] = await getDefaultProfile(ctx, address);
      const menu = new InlineKeyboard()
        .text("My Other Profiles", `all_profiles:${address}`)
        .text("Followers", `view_followers:${id}`)
        .row()
        .text("Following", `view_following:${walletLink[chatId]}`)
        .text("My Posts", `see_post:${id}`)
        .row()
        .text("Explore Posts", `explore_options`)
        .text("Search Profile", `search_profile`)
        .text("Search Post", `search_post`)
        ;
      await ctx.reply(
        `Your Profile Picture could not be rendered 😭 \n\n ${message}`,
        {
          reply_markup: menu,
          parse_mode: "HTML",
        }
      );
    } else {
      await ctx.reply(
        "😱 An error occurred. Please try again or use /start to begin 😭"
      );
    }
    console.log(`😱 Error: ${error.message.split(":")[0]}`);
    return;
  }
}


async function getSpecificProfile(ctx, id) {
  const chatId = ctx.chat.id;
  const query = `
  query Profile {
    profile(request: { profileId: "${id}" }) {
      id
      name
      bio
      attributes {
        displayType
        traitType
        key
        value
      }
      followNftAddress
      metadata
      isDefault
      picture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          verified
        }
        ... on MediaSet {
          original {
            url
            mimeType
          }
        }
        __typename
      }
      handle
      coverPicture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          verified
        }
        ... on MediaSet {
          original {
            url
            mimeType
          }
        }
        __typename
      }
      ownedBy
      dispatcher {
        address
        canUseRelay
      }
      stats {
        totalFollowers
        totalFollowing
        totalPosts
        totalComments
        totalMirrors
        totalPublications
        totalCollects
      }
      followModule {
        ... on FeeFollowModuleSettings {
          type
          amount {
            asset {
              symbol
              name
              decimals
              address
            }
            value
          }
          recipient
        }
        ... on ProfileFollowModuleSettings {
          type
        }
        ... on RevertFollowModuleSettings {
          type
        }
      }
    }
  }
  `;
  try {
    const response = await apolloClient.query({
      query: gql(query),
    });
    console.log('Lens example data: ', response);

    const profile = response.data.profile;

    if (!profile) {
      await ctx.reply(`Checking Database...`);
      return [false, null];
    }

    const name = profile.name;
    const isDefault = profile.isDefault;
    const id = profile.id;
    const bio = profile.bio;
    const handle = profile.handle;
    const metadata = profile.metadata;
    const pictureLink = (profile.picture && profile.picture.original && !profile.picture.original.url.startsWith('https://statics-polygon-lens'))
    ? convertIpfsToCloudflare(profile.picture.original.url)
    : undefined;
    const followers = profile.stats.totalFollowers;
    const following = profile.stats.totalFollowing;
    const posts = profile.stats.totalPosts;

    profileLink[chatId] = name;

    const message = `<b>${name}</b>     <code>${handle}</code>\n\n<i>Bio: ${bio}</i>\n\nFollowers:<b>${followers}</b>\nFollowing:<b>${following}</b>\nPosts:<b>${posts}</b>\n`;

    console.log(message, metadata, pictureLink)
    return [true, message, metadata, pictureLink, id, isDefault];
  }
  catch (error) {
    console.error(error);
    await ctx.reply(`😱 Error: ${error.message}`);
    return [false, null];
  }
}

async function displaySpecificProfile(ctx, id) {
  const chatId = ctx.chat.id;
  currentId[chatId] = id;
  try {
    const [profileExist, message, metadata, pictureLink, id, isDefault] = await getSpecificProfile(ctx, currentId[chatId]);
    console.log("DEFUALT RESULT IS"+isDefault);
    if (!profileExist) {
      const menu = new InlineKeyboard().url("Click here to buy a Lens Profile!", `https://opensea.io/collection/lens-protocol-profiles`);
      await ctx.reply(`Your connected wallet does not own a Lens Profile with this ID!`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
      return;
    }

    if (isDefault) {
      await  displayDefaultProfile(ctx, walletLink[chatId]);
      return;
    }
    
    if (!pictureLink) {
      const menu = new InlineKeyboard()
        .text("Back to my other Profiles", `all_profiles:${walletLink[chatId]}`)
        .text(`Go to Default Profile`, `see_default_profile:${walletLink[chatId]}`)
        ;
      await ctx.reply(`You do not have a Profile Picture! \n\n ${message}`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
      return;
    }
    
    const menu = new InlineKeyboard()
      .text("My Other Profiles", `all_profiles:${walletLink[chatId]}`)
      .text(`Go to Default Profile`, `see_default_profile:${walletLink[chatId]}`)
      ;
    
    await ctx.replyWithPhoto(`${pictureLink}`, {
      caption: `${message}`,
      reply_markup: menu,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error(error);
    if (
      error.message.includes("Bad Request: wrong file identifier/HTTP URL specified") ||
      error.message.includes("TypeError: Cannot read properties of undefined (reading 'url')")
    ) {
      const [profileExist, message, metadata, pictureLink, ] = await getSpecificProfile(ctx, id);
      const menu = new InlineKeyboard()
        .text("My Other Profiles", `all_profiles:${walletLink[chatId]}`)
        .text(`Go to Default Profile`, `see_default_profile:${walletLink[chatId]}`)
        ;

      await ctx.reply(
        `Your Profile Picture could not be rendered 😭 \n\n ${message}`,
        {
          reply_markup: menu,
          parse_mode: "HTML",
        }
      );
    } else {
      await ctx.reply(
        "😱 An error occurred. Please try again or use /start to begin 😭"
      );
    }
    console.log(`😱 Error: ${error.message.split(":")[0]}`);
    return;
  }
}

async function displaySpecificProfileOthers(ctx, id) {
  const chatId = ctx.chat.id;
  try {
    const [profileExist, message, metadata, pictureLink] = await getSpecificProfile(ctx, id);

    if (!profileExist) {
      await ctx.reply(`This profile does not exist!`, {
        parse_mode: "HTML",
      });
      return;
    }
    
    if (!pictureLink) {
      const menu = new InlineKeyboard()
        .text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`)
        .text("See Posts", `see_post:${id}`)
        ;

      await ctx.reply(`This person does not have a Profile Picture! \n\n ${message}`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
      return;
    }
    
    const menu = new InlineKeyboard()
      .text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`)
      .text("See Posts", `see_post:${id}`)
      ;
    
    await ctx.replyWithPhoto(`${pictureLink}`, {
      caption: `${message}`,
      reply_markup: menu,
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error(error);
    if (
      error.message.includes("Bad Request:") ||
      error.message.includes("TypeError:")
    ) {
      const [profileExist, message, metadata, pictureLink] = await getSpecificProfile(ctx, id);
      const menu = new InlineKeyboard()
        .text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`)
        ;

      await ctx.reply(
        `Profile Picture could not be rendered 😭 \n\n ${message}`,
        {
          reply_markup: menu,
          parse_mode: "HTML",
        }
      );
    } else {
      await ctx.reply(
        "😱 An error occurred. Please try again or use /start to begin 😭"
      );
    }
    console.log(`😱 Error: ${error.message.split(":")[0]}`);
    return;
  }
}

function convertIpfsToCloudflare(ipfsLink) {
  const ipfsPrefix = 'ipfs://';
  const cloudflareBaseUrl = 'https://cloudflare-ipfs.com/ipfs/';

  // If ipfsLink starts with 'https://', leave it as it is
  if (ipfsLink.startsWith('https://')) {
    return ipfsLink;
  }

  // If ipfsLink starts with 'ipfs://', convert it to the Cloudflare URL
  if (ipfsLink.startsWith(ipfsPrefix)) {
    const cid = ipfsLink.slice(ipfsPrefix.length);
    return cloudflareBaseUrl + cid;
  }

  // In all other cases, return the original ipfsLink
  return ipfsLink;
}

async function getAllProfiles(ctx, address) {
  const chatId = ctx.chat.id;
  const query = `
  query Profiles {
    profiles(request: { ownedBy: ["${address}"], limit: 5 }) {
      items {
        id
        name
        bio
        attributes {
          displayType
          traitType
          key
          value
        }
        followNftAddress
        metadata
        isDefault
        picture {
          ... on NftImage {
            contractAddress
            tokenId
            uri
            verified
          }
          ... on MediaSet {
            original {
              url
              mimeType
            }
          }
          __typename
        }
        handle
        coverPicture {
          ... on NftImage {
            contractAddress
            tokenId
            uri
            verified
          }
          ... on MediaSet {
            original {
              url
              mimeType
            }
          }
          __typename
        }
        ownedBy
        dispatcher {
          address
          canUseRelay
        }
        stats {
          totalFollowers
          totalFollowing
          totalPosts
          totalComments
          totalMirrors
          totalPublications
          totalCollects
        }
        followModule {
          ... on FeeFollowModuleSettings {
            type
            amount {
              asset {
                symbol
                name
                decimals
                address
              }
              value
            }
            recipient
          }
          ... on ProfileFollowModuleSettings {
           type
          }
          ... on RevertFollowModuleSettings {
           type
          }
        }
      }
      pageInfo {
        prev
        next
        totalCount
      }
    }
  }
  `;
  try {
    const response = await apolloClient.query({
      query: gql(query),
    });
    const number_profile = response.data.profiles.items.length;
    console.log("Number:" + number_profile);
    console.log(response.data.profiles.items)
    await ctx.reply(`Profiles Found: ${number_profile}`);

    if (response && response.data.profiles.items.length > 0) {
      for (let i = 0; i < response.data.profiles.items.length; i++) {
        const profile = response.data.profiles.items[i];
        const id = profile.id;
        const name = profile.name;
        const metadata = profile.metadata;
        const isdefault = profile.isDefault;
        const handle = profile.handle;
        
        const message = `<code>Profile ${i+1}</code>\n<b>${name}</b>     <code>${handle}</code>\n<i>Profile ID: ${id}</i>\n\nDefault Profile:<b>${isdefault}</b>`;;
        
        const menu = new InlineKeyboard()
          .text("View Profile Card", `access_specific_profile:${id}`);
        if (i === response.data.profiles.items.length - 1) {
          menu
            .row()
            .text("Go to Default Profile", `see_default_profile:${walletLink[chatId]}`);
        }

        await ctx.reply(`${message}`, {
          reply_markup: menu,
          parse_mode: "HTML"
        });
      }
    }
    else {
      const menu = new InlineKeyboard().url("Click here to buy a Lens Profile!", `https://opensea.io/collection/lens-protocol-profiles`);
      await ctx.reply(`Your connected wallet does not own a Lens Profile!`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
  }
  } catch (err) {
    await ctx.reply("😱 An error occurred. Please try again or use /start to begin 😭");
    console.log(`😱 Error: ${err.message}`);
  }
}

async function getFollowers(ctx, id) {
  const chatId = ctx.chat.id;
  const query = `
  query Followers {
    followers(request: { 
                  profileId: "${id}",
                limit: 10
               }) {
         items {
        wallet {
          address
          defaultProfile {
            id
            name
            bio
            attributes {
              displayType
              traitType
              key
              value
            }
            followNftAddress
              metadata
            isDefault
            handle
            picture {
              ... on NftImage {
                contractAddress
                tokenId
                uri
                verified
              }
              ... on MediaSet {
                original {
                  url
                  mimeType
                }
              }
            }
            coverPicture {
              ... on NftImage {
                contractAddress
                tokenId
                uri
                verified
              }
              ... on MediaSet {
                original {
                  url
                  mimeType
                }
              }
            }
            ownedBy
            dispatcher {
              address
              canUseRelay
            }
            stats {
              totalFollowers
              totalFollowing
              totalPosts
              totalComments
              totalMirrors
              totalPublications
              totalCollects
            }
            followModule {
              ... on FeeFollowModuleSettings {
                type
                contractAddress
                amount {
                  asset {
                    name
                    symbol
                    decimals
                    address
                  }
                  value
                }
                recipient
              }
              ... on ProfileFollowModuleSettings {
               type
              }
              ... on RevertFollowModuleSettings {
               type
              }
            }
          }
        }
        totalAmountOfTimesFollowed
      }
      pageInfo {
        prev
        next
        totalCount
      }
    }
  }
  `;
  try {
    const response = await apolloClient.query({
      query: gql(query),
    });
    const followers = response.data.followers.items.length;
    console.log("Number:" + followers);
    await ctx.reply(`Profiles Found: ${followers}`);

    if (response && response.data.followers.items.length > 0) {
      for (let i = 0; i < response.data.followers.items.length; i++) {
        const profile = response.data.followers.items[i].wallet.defaultProfile;
        console.log(profile)
        const user_id = profile.id;
        const name = profile.name;
        const bio = profile.bio;
        const metadata = profile.metadata;
        const handle = profile.handle;
  
        const message = `<code>profile ${i+1}</code>\n<b>${name}</b>     <code>${handle}</code>\n<i>Bio: ${bio}</i>`;
        
        const menu = new InlineKeyboard()
          .text(`View Profile`, `access_specific_profile_others:${user_id}`);

          if (i === response.data.followers.items.length - 1) {
            menu
              .row()
              .text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`)
            }

        await ctx.reply(`${message}`, {
          reply_markup: menu,
          parse_mode: "HTML"
        });
      }
    }
    else {
      const menu = new InlineKeyboard().text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`);

      await ctx.reply(`You do not have any followers!`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
  }
  } catch (err) {
    await ctx.reply("😱 An error occurred. Please try again or use /start to begin 😭");
    console.log(`😱 Error: ${err.message}`);
  }
}

async function getFollowing(ctx) {
  const chatId = ctx.chat.id;
  const query = `
  query Following {
    following(request: { 
                  address: "${walletLink[chatId]}",
                limit: 10
               }) {
      items {
        profile {
          id
          name
          bio
          attributes {
              displayType
              traitType
              key
              value
          }
          followNftAddress
          metadata
          isDefault
          handle
          picture {
            ... on NftImage {
              contractAddress
              tokenId
              uri
              verified
            }
            ... on MediaSet {
              original {
                url
                width
                height
                mimeType
              }
              medium {
                url
                width
                height
                mimeType
              }
              small {
                url
                width
                height
                mimeType
              }
            }
          }
          coverPicture {
            ... on NftImage {
              contractAddress
              tokenId
              uri
              verified
            }
            ... on MediaSet {
              original {
                url
                width
                height
                mimeType
              }
              small {
                width
                url
                height
                mimeType
              }
              medium {
                url
                width
                height
                mimeType
              }
            }
          }
          ownedBy
          dispatcher {
            address
            canUseRelay
          }
          stats {
            totalFollowers
            totalFollowing
            totalPosts
            totalComments
            totalMirrors
            totalPublications
            totalCollects
          }
          followModule {
            ... on FeeFollowModuleSettings {
              type
              amount {
                asset {
                  name
                  symbol
                  decimals
                  address
                }
                value
              }
              recipient
            }
            ... on ProfileFollowModuleSettings {
             type
            }
            ... on RevertFollowModuleSettings {
             type
            }
          }
        }
        totalAmountOfTimesFollowing
      }
      pageInfo {
        prev
        next
        totalCount
      }
    }
  }
  `;
  try {
    const response = await apolloClient.query({
      query: gql(query),
    });
    const following = response.data.following.items.length;
    console.log("Number:" + following);
    await ctx.reply(`Profiles Found: ${following}`);

    if (response && response.data.following.items.length > 0) {
      for (let i = 0; i < response.data.following.items.length; i++) {
        const profile = response.data.following.items[i].profile;
        console.log(profile)
        const id = profile.id;
        const name = profile.name;
        const bio = profile.bio;
        const metadata = profile.metadata;
        const handle = profile.handle;
  
        const message = `<code>profile ${i+1}</code>\n<b>${name}</b>     <code>${handle}</code>\n<i>Bio: ${bio}</i>`;
        
        const menu = new InlineKeyboard()
          .text(`View Profile`, `access_specific_profile_others:${id}`)

          if (i === response.data.following.items.length - 1) {
            menu
              .row()
              .text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`);
            }

        await ctx.reply(`${message}`, {
          reply_markup: menu,
          parse_mode: "HTML"
        });
      }
    }
    else {
      const menu = new InlineKeyboard().text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`);
      await ctx.reply(`You do not have any followers!`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
  }
  } catch (err) {
    await ctx.reply("😱 An error occurred. Please try again or use /start to begin 😭");
    console.log(`😱 Error: ${err.message}`);
  }
}

async function seePosts(ctx, id) {
  const chatId = ctx.chat.id;
  const query = `
  query Publications {
    publications(request: {
      profileId: "${id}",
      publicationTypes: [POST],
      limit: 10
    }) {
      items {
        __typename 
        ... on Post {
          ...PostFields
        }
        ... on Comment {
          ...CommentFields
        }
        ... on Mirror {
          ...MirrorFields
        }
      }
      pageInfo {
        prev
        next
        totalCount
      }
    }
  }
  
  fragment MediaFields on Media {
    url
    mimeType
  }
  
  fragment ProfileFields on Profile {
    id
    name
    bio
    attributes {
       displayType
       traitType
       key
       value
    }
    isFollowedByMe
    isFollowing(who: null)
    followNftAddress
    metadata
    isDefault
    handle
    picture {
      ... on NftImage {
        contractAddress
        tokenId
        uri
        verified
      }
      ... on MediaSet {
        original {
          ...MediaFields
        }
      }
    }
    coverPicture {
      ... on NftImage {
        contractAddress
        tokenId
        uri
        verified
      }
      ... on MediaSet {
        original {
          ...MediaFields
        }
      }
    }
    ownedBy
    dispatcher {
      address
    }
    stats {
      totalFollowers
      totalFollowing
      totalPosts
      totalComments
      totalMirrors
      totalPublications
      totalCollects
    }
    followModule {
      ...FollowModuleFields
    }
  }
  
  fragment PublicationStatsFields on PublicationStats { 
    totalAmountOfMirrors
    totalAmountOfCollects
    totalAmountOfComments
    totalUpvotes
    totalDownvotes
  }
  
  fragment MetadataOutputFields on MetadataOutput {
    name
    description
    content
    media {
      original {
        ...MediaFields
      }
    }
    attributes {
      displayType
      traitType
      value
    }
  }
  
  fragment Erc20Fields on Erc20 {
    name
    symbol
    decimals
    address
  }
  
  fragment PostFields on Post {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ...ReferenceModuleFields
    }
    appId
    hidden
    reaction(request: null)
    mirrors(by: null)
    hasCollectedByMe
  }
  
  fragment MirrorBaseFields on Mirror {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ...ReferenceModuleFields
    }
    appId
    hidden
    reaction(request: null)
    hasCollectedByMe
  }
  
  fragment MirrorFields on Mirror {
    ...MirrorBaseFields
    mirrorOf {
     ... on Post {
        ...PostFields          
     }
     ... on Comment {
        ...CommentFields          
     }
    }
  }
  
  fragment CommentBaseFields on Comment {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ...ReferenceModuleFields
    }
    appId
    hidden
    reaction(request: null)
    mirrors(by: null)
    hasCollectedByMe
  }
  
  fragment CommentFields on Comment {
    ...CommentBaseFields
    mainPost {
      ... on Post {
        ...PostFields
      }
      ... on Mirror {
        ...MirrorBaseFields
        mirrorOf {
          ... on Post {
             ...PostFields          
          }
          ... on Comment {
             ...CommentMirrorOfFields        
          }
        }
      }
    }
  }
  
  fragment CommentMirrorOfFields on Comment {
    ...CommentBaseFields
    mainPost {
      ... on Post {
        ...PostFields
      }
      ... on Mirror {
         ...MirrorBaseFields
      }
    }
  }
  
  fragment FollowModuleFields on FollowModule {
    ... on FeeFollowModuleSettings {
      type
      amount {
        asset {
          name
          symbol
          decimals
          address
        }
        value
      }
      recipient
    }
    ... on ProfileFollowModuleSettings {
      type
      contractAddress
    }
    ... on RevertFollowModuleSettings {
      type
      contractAddress
    }
    ... on UnknownFollowModuleSettings {
      type
      contractAddress
      followModuleReturnData
    }
  }
  
  fragment CollectModuleFields on CollectModule {
    __typename
    ... on FreeCollectModuleSettings {
      type
      followerOnly
      contractAddress
    }
    ... on FeeCollectModuleSettings {
      type
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
    }
    ... on LimitedFeeCollectModuleSettings {
      type
      collectLimit
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
    }
    ... on LimitedTimedFeeCollectModuleSettings {
      type
      collectLimit
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
      endTimestamp
    }
    ... on RevertCollectModuleSettings {
      type
    }
    ... on TimedFeeCollectModuleSettings {
      type
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
      endTimestamp
    }
    ... on UnknownCollectModuleSettings {
      type
      contractAddress
      collectModuleReturnData
    }
  }
  
  fragment ReferenceModuleFields on ReferenceModule {
    ... on FollowOnlyReferenceModuleSettings {
      type
      contractAddress
    }
    ... on UnknownReferenceModuleSettings {
      type
      contractAddress
      referenceModuleReturnData
    }
    ... on DegreesOfSeparationReferenceModuleSettings {
      type
      contractAddress
      commentsRestricted
      mirrorsRestricted
      degreesOfSeparation
    }
  }
  
  `;
  try {
    const response = await apolloClient.query({
      query: gql(query),
    });
    const posts = response.data.publications.items.length;
    console.log("Number:" + posts);
    await ctx.reply(`⏳ Retrieving Posts...`);

    if (response && response.data.publications.items.length > 0) {
      for (let i = 0; i < response.data.publications.items.length; i++) {
        const post = response.data.publications.items[i];
        const title = post.metadata.name;
        const content = post.metadata.content;        
        const image = post.metadata.media && post.metadata.media.length > 0 ? convertIpfsToCloudflare(post.metadata.media[0].original.url) : undefined;
        const date = post.createdAt;
        const formattedDate = date.split('T')[0];
        const message = `<i>${content}</i>\n\n<code>${title} on ${formattedDate}</code>`;
        
        const menu = new InlineKeyboard()
          .text(`Something`);

        if (i === response.data.publications.items.length - 1) {
            menu
              .row()
              .text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`);
        }

        if (image === undefined) {
          await ctx.reply(`${message}`, {
            reply_markup: menu,
            parse_mode: "HTML",
          });
        } else {
          await ctx.replyWithPhoto(`${image}`, {
            caption: `${message}`,
            reply_markup: menu,
            parse_mode: "HTML",
          });
        }
      }
    }
    else {
      const menu = new InlineKeyboard()
          .text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`);
      await ctx.reply(`No Posts Found!`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
    }
  } catch (err) {
    await ctx.reply("😱 An error occurred. Please try again or use /start to begin 😭");
    console.log(`😱 Error: ${err.message}`);
  }
}

async function exploreOptions(ctx){
  const chatId = ctx.chat.id;
  const message = "Please choose what type of post you would like to explore!";
  const menu = new InlineKeyboard()
  .text(`Top Commented`, `explore_posts:TOP_COMMENTED`)
  .text(`Top Collected`, `explore_posts:TOP_COLLECTED`)
  .row()
  .text(`Top Mirrored`, `explore_posts:TOP_MIRRORED`)
  .text(`Latest`, `explore_posts:LATEST`)
  .row()
  .text(`Curated`, `explore_posts:CURATED_PROFILES`)
  .text(`My Profile`, `see_default_profile:${walletLink[chatId]}`);
  ;
  await ctx.reply(`${message}`, {
    reply_markup: menu,
    parse_mode: "HTML",
  });
}

async function explorePosts(ctx, option) {
  const chatId = ctx.chat.id;
  const query = `
  query ExplorePublications {
    explorePublications(request: {
      sortCriteria: ${option},
      publicationTypes: [POST],
      limit: 5
    }) {
      items {
        __typename 
        ... on Post {
          ...PostFields
        }
        ... on Comment {
          ...CommentFields
        }
        ... on Mirror {
          ...MirrorFields
        }
      }
      pageInfo {
        prev
        next
        totalCount
      }
    }
  }
  
  fragment MediaFields on Media {
    url
    width
    height
    mimeType
  }
  
  fragment ProfileFields on Profile {
    id
    name
    bio
    attributes {
      displayType
      traitType
      key
      value
    }
    isFollowedByMe
    isFollowing(who: null)
    followNftAddress
    metadata
    isDefault
    handle
    picture {
      ... on NftImage {
        contractAddress
        tokenId
        uri
        verified
      }
      ... on MediaSet {
        original {
          ...MediaFields
        }
        small {
          ...MediaFields
        }
        medium {
          ...MediaFields
        }
      }
    }
    coverPicture {
      ... on NftImage {
        contractAddress
        tokenId
        uri
        verified
      }
      ... on MediaSet {
        original {
          ...MediaFields
        }
        small {
         ...MediaFields
        }
        medium {
          ...MediaFields
        }
      }
    }
    ownedBy
    dispatcher {
      address
    }
    stats {
      totalFollowers
      totalFollowing
      totalPosts
      totalComments
      totalMirrors
      totalPublications
      totalCollects
    }
    followModule {
      ...FollowModuleFields
    }
  }
  
  fragment PublicationStatsFields on PublicationStats { 
    totalAmountOfMirrors
    totalAmountOfCollects
    totalAmountOfComments
  }
  
  fragment MetadataOutputFields on MetadataOutput {
    name
    description
    content
    media {
      original {
        ...MediaFields
      }
      small {
        ...MediaFields
      }
      medium {
        ...MediaFields
      }
    }
    attributes {
      displayType
      traitType
      value
    }
  }
  
  fragment Erc20Fields on Erc20 {
    name
    symbol
    decimals
    address
  }
  
  fragment PostFields on Post {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ...ReferenceModuleFields
    }
    appId
    hidden
    reaction(request: null)
    mirrors(by: null)
    hasCollectedByMe
  }
  
  fragment MirrorBaseFields on Mirror {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ...ReferenceModuleFields
    }
    appId
    hidden
    reaction(request: null)
    hasCollectedByMe
  }
  
  fragment MirrorFields on Mirror {
    ...MirrorBaseFields
    mirrorOf {
     ... on Post {
        ...PostFields          
     }
     ... on Comment {
        ...CommentFields          
     }
    }
  }
  
  fragment CommentBaseFields on Comment {
    id
    profile {
      ...ProfileFields
    }
    stats {
      ...PublicationStatsFields
    }
    metadata {
      ...MetadataOutputFields
    }
    createdAt
    collectModule {
      ...CollectModuleFields
    }
    referenceModule {
      ...ReferenceModuleFields
    }
    appId
    hidden
    reaction(request: null)
    mirrors(by: null)
    hasCollectedByMe
  }
  
  fragment CommentFields on Comment {
    ...CommentBaseFields
    mainPost {
      ... on Post {
        ...PostFields
      }
      ... on Mirror {
        ...MirrorBaseFields
        mirrorOf {
          ... on Post {
             ...PostFields          
          }
          ... on Comment {
             ...CommentMirrorOfFields        
          }
        }
      }
    }
  }
  
  fragment CommentMirrorOfFields on Comment {
    ...CommentBaseFields
    mainPost {
      ... on Post {
        ...PostFields
      }
      ... on Mirror {
         ...MirrorBaseFields
      }
    }
  }
  
  fragment FollowModuleFields on FollowModule {
    ... on FeeFollowModuleSettings {
      type
      amount {
        asset {
          name
          symbol
          decimals
          address
        }
        value
      }
      recipient
    }
    ... on ProfileFollowModuleSettings {
      type
      contractAddress
    }
    ... on RevertFollowModuleSettings {
      type
      contractAddress
    }
    ... on UnknownFollowModuleSettings {
      type
      contractAddress
      followModuleReturnData
    }
  }
  
  fragment CollectModuleFields on CollectModule {
    __typename
    ... on FreeCollectModuleSettings {
      type
      followerOnly
      contractAddress
    }
    ... on FeeCollectModuleSettings {
      type
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
    }
    ... on LimitedFeeCollectModuleSettings {
      type
      collectLimit
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
    }
    ... on LimitedTimedFeeCollectModuleSettings {
      type
      collectLimit
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
      endTimestamp
    }
    ... on RevertCollectModuleSettings {
      type
    }
    ... on TimedFeeCollectModuleSettings {
      type
      amount {
        asset {
          ...Erc20Fields
        }
        value
      }
      recipient
      referralFee
      endTimestamp
    }
    ... on UnknownCollectModuleSettings {
      type
      contractAddress
      collectModuleReturnData
    }
  }
  
  fragment ReferenceModuleFields on ReferenceModule {
    ... on FollowOnlyReferenceModuleSettings {
      type
      contractAddress
    }
    ... on UnknownReferenceModuleSettings {
      type
      contractAddress
      referenceModuleReturnData
    }
    ... on DegreesOfSeparationReferenceModuleSettings {
      type
      contractAddress
      commentsRestricted
      mirrorsRestricted
      degreesOfSeparation
    }
  }  
  `;
  try {
    const response = await apolloClient.query({
      query: gql(query),
    });
    const posts = response.data.explorePublications.items.length;
    console.log("Number:" + posts);
    await ctx.reply(`⏳ Retrieving Posts...`);

    if (response && response.data.explorePublications.items.length > 0) {
      for (let i = 0; i < response.data.explorePublications.items.length; i++) {
        try {
          const post = response.data.explorePublications.items[i];
          console.log(post)
          const poster_id = post.profile.id;
          const title = post.metadata.name;
          const content = post.metadata.content;        
          const image = post.metadata.media && post.metadata.media.length > 0 ? convertIpfsToCloudflare(post.metadata.media[0].original.url) : undefined;
          const date = post.createdAt;
          const formattedDate = date.split('T')[0];
          const message = `<i>${content}</i>\n\n<code>${title} on ${formattedDate}</code>`;

          const menu = new InlineKeyboard()
            .text(`View Profile`, `access_specific_profile_others:${poster_id}`);

          if (i === response.data.explorePublications.items.length - 1) {
            menu
              .row()
              .text(`Back to my Profile`, `see_default_profile:${walletLink[chatId]}`);
          }

          if (image === undefined) {
            await ctx.reply(`${message}`, {
              reply_markup: menu,
              parse_mode: "HTML",
            });
          } else {
            await ctx.replyWithPhoto(`${image}`, {
              caption: `${message}`,
              reply_markup: menu,
              parse_mode: "HTML",
            });
          }
        } catch (postError) {
          console.log(`😱 Post error: ${postError.message}`);
          if (i === response.data.explorePublications.items.length - 1) {
            await ctx.reply(`😱 Last post could not be rendered. Use /start to go back to your profile.`)
            console.log(`An error occurred with post number ${i+1}`)
            ;}
            else{
              console.log(`Error with post number ${i+1}. Continuing with the next post...`);
            }
        }
      }
    }
    else {
      const menu = new InlineKeyboard()
          .text(`Back to my Profile`, `see_default_profile:${walletLink[chatId]}`);
      await ctx.reply(`No Posts to suggest!`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
    }
  } catch (err) {
    await ctx.reply("😱 An error occurred. Please try again or use /start to begin 😭");
    console.log(`😱 Error: ${err.message}`);
  }
}

async function searchProfile(conversation, ctx) {
  const chatId = ctx.chat.id;
  console.log(defaultId[chatId])
          await ctx.answerCallbackQuery();
          await ctx.reply("Who are you looking for? 😁 \nClick /cancel to stop");
          const searched_name = await conversation.form.text()

          if (searched_name === "/cancel") {
            const menu = new InlineKeyboard()
            .text(`Back to Default Profile`, `see_default_profile:${walletLink[chatId]}`)
            await ctx.reply("🚫 Search cancelled.",
            {reply_markup: menu, parse_mode: "HTML"});
              return;
  }
  else{
    const query = `
    query Search {
      search(request: {
        query: "${searched_name}",
        type: PROFILE,
        limit: 10
      }) {
        ... on ProfileSearchResult {
          __typename 
          items {
            ... on Profile {
              ...ProfileFields
            }
          }
          pageInfo {
            prev
            totalCount
            next
          }
        }
      }
    }
    
    fragment MediaFields on Media {
      url
      mimeType
    }
    
    fragment ProfileFields on Profile {
      profileId: id,
      name
      bio
      attributes {
        displayType
        traitType
        key
        value
      }
      isFollowedByMe
      isFollowing(who: "${defaultId[chatId]}")
      followNftAddress
      metadata
      isDefault
      handle
      picture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          verified
        }
        ... on MediaSet {
          original {
            ...MediaFields
          }
        }
      }
      coverPicture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          verified
        }
        ... on MediaSet {
          original {
            ...MediaFields
          }
        }
      }
      ownedBy
      dispatcher {
        address
      }
      stats {
        totalFollowers
        totalFollowing
        totalPosts
        totalComments
        totalMirrors
        totalPublications
        totalCollects
      }
      followModule {
        ... on FeeFollowModuleSettings {
        type
        amount {
          asset {
            name
            symbol
            decimals
            address
          }
          value
        }
        recipient
        }
        ... on ProfileFollowModuleSettings {
          type
          contractAddress
        }
        ... on RevertFollowModuleSettings {
          type
          contractAddress
        }
        ... on UnknownFollowModuleSettings {
          type
          contractAddress
          followModuleReturnData
        }
      }
    }
  `;
  try {
    const response = await apolloClient.query({
      query: gql(query),
    });
    const number_profile = response.data.search.items.length;
    console.log("Number:" + number_profile);
    console.log(response.data.search.items)
    await ctx.reply(`${number_profile} Profiles found matching search for '${searched_name}'`);

    if (response && response.data.search.items.length > 0) {
      for (let i = 0; i < response.data.search.items.length; i++) {
        const profile = response.data.search.items[i];

        const name = profile.name;
        const id = profile.profileId;
        const bio = profile.bio;
        const handle = profile.handle;
        const metadata = profile.metadata;
        const pictureLink = (profile.picture && profile.picture.original && !profile.picture.original.url.startsWith('https://statics-polygon-lens'))
        ? convertIpfsToCloudflare(profile.picture.original.url)
        : undefined;
        const isFollowing = profile.isFollowing ? 'follows you' : 'does not follow you';
        const isFollowedByMe = profile.isFollowedByMe ? 'You Follow this Person' : 'You are not Following this person';
        const followers = profile.stats.totalFollowers;
        const following = profile.stats.totalFollowing;
        const posts = profile.stats.totalPosts;
    
        profileLink[chatId] = name;
    
        const message = `<b>${name}</b>     <code>${handle}</code>\n\n<i>Bio: ${bio}</i>\n${isFollowing}\n${isFollowedByMe}\n\nFollowers:<b>${followers}</b>\nFollowing:<b>${following}</b>\nPosts:<b>${posts}</b>\n`;
        
        const menu = new InlineKeyboard()
          .text("View Profile Card", `access_specific_profile_others:${id}`);
        if (i === response.data.search.items.length - 1) {
          menu
            .row()
            .text("Back to Default Profile", `see_default_profile:${walletLink[chatId]}`);
        }

        await ctx.reply(`${message}`, {
          reply_markup: menu,
          parse_mode: "HTML"
        });
      }
    }
    else {
      const menu = new InlineKeyboard()          
        .text("Search for Another Profile", `search_profile`);
      await ctx.reply(`No profiles found matching '${searched_name}'`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
  }
  } catch (err) {
    await ctx.reply("😱 An error occurred. Please try again or use /start to begin 😭");
    console.log(`😱 Error: ${err.message}`);
  }
}
};

async function searchPublication(conversation, ctx) {
  const chatId = ctx.chat.id;
  console.log(defaultId[chatId])
          await ctx.answerCallbackQuery();
          await ctx.reply("What post are you searching for? 😁 \nClick /cancel to stop");
          const searched_post = await conversation.form.text()

          if (searched_post === "/cancel") {
            const menu = new InlineKeyboard()
            .text(`Back to Default Profile`, `see_default_profile:${walletLink[chatId]}`)
            await ctx.reply("🚫 Search cancelled.",
            {reply_markup: menu, parse_mode: "HTML"});
              return;
  }
  else{
    const query = `
    query Search {
      search(request: {
        query: "${searched_post}",
        type: PUBLICATION,
        limit: 10
      }) {
        ... on PublicationSearchResult {
           __typename 
          items {
            __typename 
            ... on Comment {
              ...CommentFields
            }
            ... on Post {
              ...PostFields
            }
          }
          pageInfo {
            prev
            totalCount
            next
          }
        }
        ... on ProfileSearchResult {
          __typename 
          items {
            ... on Profile {
              ...ProfileFields
            }
          }
          pageInfo {
            prev
            totalCount
            next
          }
        }
      }
    }
    
    fragment MediaFields on Media {
      url
      mimeType
    }
    
    fragment MirrorBaseFields on Mirror {
      id
      profile {
        ...ProfileFields
      }
      stats {
        ...PublicationStatsFields
      }
      metadata {
        ...MetadataOutputFields
      }
      createdAt
      collectModule {
        ...CollectModuleFields
      }
      referenceModule {
        ...ReferenceModuleFields
      }
      appId
    }
    
    fragment ProfileFields on Profile {
      profileId: id,
      name
      bio
      attributes {
         displayType
         traitType
         key
         value
      }
      isFollowedByMe
      isFollowing(who: null)
      metadataUrl: metadata
      isDefault
      handle
      picture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          verified
        }
        ... on MediaSet {
          original {
            ...MediaFields
          }
        }
      }
      coverPicture {
        ... on NftImage {
          contractAddress
          tokenId
          uri
          verified
        }
        ... on MediaSet {
          original {
            ...MediaFields
          }
        }
      }
      ownedBy
      dispatcher {
        address
      }
      stats {
        totalFollowers
        totalFollowing
        totalPosts
        totalComments
        totalMirrors
        totalPublications
        totalCollects
      }
      followModule {
        ...FollowModuleFields
      }
    }
    
    fragment PublicationStatsFields on PublicationStats { 
      totalAmountOfMirrors
      totalAmountOfCollects
      totalAmountOfComments
    }
    
    fragment MetadataOutputFields on MetadataOutput {
      name
      description
      content
      media {
        original {
          ...MediaFields
        }
      }
      attributes {
        displayType
        traitType
        value
      }
    }
    
    fragment Erc20Fields on Erc20 {
      name
      symbol
      decimals
      address
    }
    
    fragment PostFields on Post {
      id
      profile {
        ...ProfileFields
      }
      stats {
        ...PublicationStatsFields
      }
      metadata {
        ...MetadataOutputFields
      }
      createdAt
      collectModule {
        ...CollectModuleFields
      }
      referenceModule {
        ...ReferenceModuleFields
      }
      appId
      hidden
      reaction(request: null)
      mirrors(by: null)
      hasCollectedByMe
    }
    
    fragment CommentBaseFields on Comment {
      id
      profile {
        ...ProfileFields
      }
      stats {
        ...PublicationStatsFields
      }
      metadata {
        ...MetadataOutputFields
      }
      createdAt
      collectModule {
        ...CollectModuleFields
      }
      referenceModule {
        ...ReferenceModuleFields
      }
      appId
      hidden
      reaction(request: null)
      mirrors(by: null)
      hasCollectedByMe
    }
    
    fragment CommentFields on Comment {
      ...CommentBaseFields
      mainPost {
        ... on Post {
          ...PostFields
        }
        ... on Mirror {
          ...MirrorBaseFields
          mirrorOf {
            ... on Post {
               ...PostFields          
            }
            ... on Comment {
               ...CommentMirrorOfFields        
            }
          }
        }
      }
    }
    
    fragment CommentMirrorOfFields on Comment {
      ...CommentBaseFields
      mainPost {
        ... on Post {
          ...PostFields
        }
        ... on Mirror {
           ...MirrorBaseFields
        }
      }
    }
    
    fragment FollowModuleFields on FollowModule {
      ... on FeeFollowModuleSettings {
        type
        amount {
          asset {
            name
            symbol
            decimals
            address
          }
          value
        }
        recipient
      }
      ... on ProfileFollowModuleSettings {
        type
        contractAddress
      }
      ... on RevertFollowModuleSettings {
        type
        contractAddress
      }
      ... on UnknownFollowModuleSettings {
        type
        contractAddress
        followModuleReturnData
      }
    }
    
    fragment CollectModuleFields on CollectModule {
      __typename
      ... on FreeCollectModuleSettings {
        type
        followerOnly
        contractAddress
      }
      ... on FeeCollectModuleSettings {
        type
        amount {
          asset {
            ...Erc20Fields
          }
          value
        }
        recipient
        referralFee
      }
      ... on LimitedFeeCollectModuleSettings {
        type
        collectLimit
        amount {
          asset {
            ...Erc20Fields
          }
          value
        }
        recipient
        referralFee
      }
      ... on LimitedTimedFeeCollectModuleSettings {
        type
        collectLimit
        amount {
          asset {
            ...Erc20Fields
          }
          value
        }
        recipient
        referralFee
        endTimestamp
      }
      ... on RevertCollectModuleSettings {
        type
      }
      ... on TimedFeeCollectModuleSettings {
        type
        amount {
          asset {
            ...Erc20Fields
          }
          value
        }
        recipient
        referralFee
        endTimestamp
      }
      ... on UnknownCollectModuleSettings {
        type
        contractAddress
        collectModuleReturnData
      }
    }
    
    fragment ReferenceModuleFields on ReferenceModule {
      ... on FollowOnlyReferenceModuleSettings {
        type
        contractAddress
      }
      ... on UnknownReferenceModuleSettings {
        type
        contractAddress
        referenceModuleReturnData
      }
      ... on DegreesOfSeparationReferenceModuleSettings {
        type
        contractAddress
        commentsRestricted
        mirrorsRestricted
        degreesOfSeparation
      }
    }
  `;
  try {
    const response = await apolloClient.query({
      query: gql(query),
    });
    const number_post = response.data.search.items.length;
    console.log("Number:" + number_post);
    console.log(response.data.search.items)
    await ctx.reply(`Retrieving Posts that match: '${searched_post}'`);

    if (response && response.data.search.items.length > 0) {
      for (let i = 0; i < response.data.search.items.length; i++) {
        try {
        const post = response.data.search.items[i];
        const author = post.profile.handle;
        const id = post.profile.profileId;
        const title = post.metadata.name;
        const content = post.metadata.content;        
        const image = post.metadata.media && post.metadata.media.length > 0 ? convertIpfsToCloudflare(post.metadata.media[0].original.url) : undefined;
        const date = post.createdAt;
        const formattedDate = date.split('T')[0];
        const message = `<i>${content}</i>\n\n<code>${title} on ${formattedDate}</code>`;
        
        const menu = new InlineKeyboard()
          .text(`View Profile`, `access_specific_profile_others:${id}`);

        if (i === response.data.search.items.length - 1) {
            menu
              .row()
              .text(`Back to Profile`, `see_default_profile:${walletLink[chatId]}`);
        }

        if (image === undefined) {
          await ctx.reply(`${message}`, {
            reply_markup: menu,
            parse_mode: "HTML",
          });
        } else {
          await ctx.replyWithPhoto(`${image}`, {
            caption: `${message}`,
            reply_markup: menu,
            parse_mode: "HTML",
          });
        }
      } catch (postError) {
        console.log(`😱 Post error: ${postError.message}`);
        if (i === response.data.search.items.length - 1) {
          await ctx.reply(`😱 Last post could not be rendered. Use /start to go back to your profile.`)
            console.log(`An error occurred with post number ${i+1}`)
            ;}
          else{
            console.log(`Error occurred with post number ${i+1}. Continuing with the next post...`);
          }
      }
    }
    }
    else {
      const menu = new InlineKeyboard()          
        .text("Search for Another Post", `search_post`);
      await ctx.reply(`No posts found matching '${searched_post}'`, {
        reply_markup: menu,
        parse_mode: "HTML",
      });
  }
  } catch (err) {
    await ctx.reply("😱 An error occurred. Please try again or use /start to begin 😭");
    console.log(`😱 Error: ${err.message}`);
  }
}
};

bot.use(session({ initial: () => ({}) }));
bot.use(conversations());
bot.use(createConversation(searchProfile));
bot.use(createConversation(searchPublication));


bot.use(async(ctx) => {
  const chatId = ctx.chat.id;
  console.log('Received update:', ctx.update);

  // Check if the message property exists
  if ('message' in ctx.update && 'web_app_data' in ctx.update.message) {
    const { web_app_data } = ctx.update.message;
    const data = web_app_data.data;
    console.log(data)
    const parsedData = JSON.parse(data);
    const address = parsedData.address;
    walletLink[chatId] = address;
    const menu = new InlineKeyboard()
        .text("Access Default Profile", `see_default_profile:${address}`)
        .row()
        .text("See All Profiles", `see_all_profiles:${address}`);
    ctx.reply(`User has connected wallet <code>${address}</code>`,
    {          
      reply_markup: menu,
      parse_mode: "HTML",
    });
    return address;
  } else if (ctx.update.callback_query) {
    console.log('Callback query update:', ctx.update.callback_query);
    const callbackData = ctx.update.callback_query.data;
    const [action, information] = callbackData.split(':');

    if (action === 'see_default_profile') {
      displayDefaultProfile(ctx, information);
    } else if (action === 'see_all_profiles') {
      getAllProfiles(ctx, information);
    } else if (action === 'access_specific_profile') {
      displaySpecificProfile(ctx, information);
    } else if (action === 'access_specific_profile_others') {
      displaySpecificProfileOthers(ctx, information);
    } else if (action === 'all_profiles') {
      getAllProfiles(ctx, information);
    } else if (action === 'view_followers') {
      getFollowers(ctx, information);
    } else if (action === 'view_following') {
      getFollowing(ctx, information);
    } else if (action === 'see_post') {
      seePosts(ctx, information);
    } else if (action === 'explore_options') {
      exploreOptions(ctx);
    } else if (action === 'explore_posts') {
      explorePosts(ctx, information);
    } else if (action === 'search_profile') {
      await ctx.conversation.enter("searchProfile");
    } else if (action === 'search_post') {
      await ctx.conversation.enter("searchPublication");
    } else {
      console.log(`Unknown action: ${action}`);
    }
  } else {
    console.log('Message and callback_query properties not found in the update object');
  }
});

bot.start();

