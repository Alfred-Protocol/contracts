const { ethers } = require("hardhat");
const { tryNativeToHexString } = require("@certusone/wormhole-sdk");

// wormhole event ABIs
const WORMHOLE_TOPIC = "0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2";
const WORMHOLE_MESSAGE_EVENT_ABI = [
  "event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)",
];

async function parseWormholeEventsFromReceipt(receipt){
    // create the wormhole message interface
    const wormholeMessageInterface = new ethers.utils.Interface(
      WORMHOLE_MESSAGE_EVENT_ABI
    );
  
    // loop through the logs and parse the events that were emitted
    let logDescriptions = [];
    for (const log of receipt.logs) {
      if (log.topics.includes(WORMHOLE_TOPIC)) {
        logDescriptions.push(wormholeMessageInterface.parseLog(log));
      }
    }
    return logDescriptions;
  }

async function formatWormholeMessageFromReceipt(receipt, emitterChainId) {
    // parse the wormhole message logs
    const messageEvents = await parseWormholeEventsFromReceipt(receipt);
  
    // find VAA events
    if (messageEvents.length == 0) {
      throw new Error("No Wormhole messages found!");
    }
  
    let results = [];
  
    // loop through each event and format the wormhole Observation (message body)
    for (const event of messageEvents) {
      // create a timestamp and find the emitter address
      const timestamp = Math.floor(+new Date() / 1000);
      const emitterAddress = ethers.utils.hexlify(
        "0x" + tryNativeToHexString(event.args.sender, emitterChainId)
      );
  
      // encode the observation
      const encodedObservation = ethers.utils.solidityPack(
        ["uint32", "uint32", "uint16", "bytes32", "uint64", "uint8", "bytes"],
        [
          timestamp,
          event.args.nonce,
          emitterChainId,
          emitterAddress,
          event.args.sequence,
          event.args.consistencyLevel,
          event.args.payload,
        ]
      );
  
      // append the observation to the results buffer array
      results.push(Buffer.from(encodedObservation.substring(2), "hex"));
    }
  
    return results;
}

module.exports = {
    formatWormholeMessageFromReceipt: formatWormholeMessageFromReceipt
}