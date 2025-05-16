import os
import json
import time
import logging
from dotenv import load_dotenv
from vastai import VastAI

# Why does this matter? Setting up logging helps track GPU availability and bid status over time
# This helps debug issues and monitor the bidding process
logging.basicConfig(
    filename='bidder.log',
    level=logging.INFO,
    format='%(asctime)s - %(message)s'
)

def check_and_create_instances():
    # Load environment variables from .env file
    load_dotenv()

    # Get API key from environment variables
    api_key = os.getenv('VAST_API_KEY')
    template_hash = os.getenv('VAST_TEMPLATE_HASH')
    vast_sdk = VastAI(api_key=api_key)

    print("\n=== CHECKING AVAILABLE MACHINES ===")
    print(f"Using API key: {api_key[:6]}...{api_key[-4:]}")
    print(f"Template hash: {template_hash}")

    # Check available machines
    machines_raw = vast_sdk.search_offers(
        order='flops_per_dphtotal',
        type="interruptible",
        query="gpu_name=RTX_4090", 
        raw=True
    )
    machines = json.loads(machines_raw)
    time.sleep(0.5)  # 500ms delay after API request

    print(f"\nFound {len(machines)} total machines matching criteria")
    print("Raw machine data:", json.dumps(machines, indent=2))

    # Print information for each machine
    for machine in machines:
        cost_per_gpu = machine['dph_total'] / machine['num_gpus']
        print(f"\n=== MACHINE DETAILS ===")
        print(f"Machine ID: {machine['id']}")
        print(f"GPU Name: {machine['gpu_name']}")
        print(f"Number of GPUs: {machine['num_gpus']}")
        print(f"Total Cost/hr: ${machine['dph_total']:.3f}")
        print(f"Cost per GPU/hr: ${cost_per_gpu:.3f}")
        print(f"Current Status: {machine.get('status', 'Unknown')}")
        print(f"Location: {machine.get('location', 'Unknown')}")
        
        logging.info(f"Found machine {machine['id']} with {machine['num_gpus']} x {machine['gpu_name']} at ${cost_per_gpu:.3f}/GPU/hr")
        
        if cost_per_gpu <= 0.2: # Set ceiling to $0.2/h
            print("\n=== PLACING BID ===")
            print(f"Machine qualifies for bidding (cost <= $0.20/hr)")
            bid_price = machine['dph_total'] * 2.1 # place a bid that is 110% above min
            print(f"Setting initial bid at ${bid_price:.3f} (110% above ${machine['dph_total']:.2f})")
            print(f"Placing bid on machine {machine['id']} at ${bid_price:.3f} total (${bid_price/machine['num_gpus']:.3f}/GPU)")
            logging.info(f"Placing bid on machine {machine['id']} at ${bid_price:.3f} total (${bid_price/machine['num_gpus']:.3f}/GPU)")
            
            try:
                x = vast_sdk.create_instance(
                    ID=machine['id'],
                    template_hash=template_hash,
                    price=bid_price
                )
                print(f"Bid response: {json.dumps(x, indent=2)}")
                logging.info(f"Bid response: {x}")
            except Exception as e:
                print(f"Error placing bid: {e}")
                logging.error(f"Error placing bid: {e}")
            
            time.sleep(0.5)  # 500ms delay after API request
        else:
            print(f"Machine cost too high (${cost_per_gpu:.3f}/GPU/hr > $0.20/hr), skipping bid")

    print("\n=== CHECKING EXISTING INSTANCES ===")
    # Check instances
    instances_raw = vast_sdk.show_instances(raw=True)
    instances = json.loads(instances_raw)
    print("Raw instances data:", json.dumps(instances, indent=2))
    time.sleep(0.5)  # 500ms delay after API request
    active_gpus = 0

    for instance in instances:
        print(f"\n=== INSTANCE {instance['id']} ===")
        print(f"Status: {instance['actual_status']}")
        print(f"Is Bid: {instance['is_bid']}")
        print(f"Intended Status: {instance['intended_status']}")
        print(f"Number of GPUs: {instance['num_gpus']}")
        print(f"Current Price: ${instance.get('min_bid', 'Unknown')}")

        if instance['actual_status'] == "running":
            active_gpus += instance['num_gpus']
            print(f"Instance {instance['id']} running with {instance['num_gpus']} GPUs")
            logging.info(f"Instance {instance['id']} running with {instance['num_gpus']} GPUs")
        if instance['is_bid'] == True and instance['intended_status'] == "stopped":
            try:
                cost_per_gpu = machine['dph_total'] / machine['num_gpus']
                if cost_per_gpu <= 0.2: # Set ceiling to $0.2/h
                    bid_price = instance['min_bid'] * 2.1
                    print(f"\n=== UPDATING BID ===")
                    print(f"Updating bid on instance {instance['id']} to ${bid_price:.3f} (was ${instance['min_bid']:.3f})")
                    logging.info(f"Updating bid on instance {instance['id']} to ${bid_price:.3f} (was ${instance['min_bid']:.3f})")
                    x = vast_sdk.change_bid(id=instance['id'], price=bid_price)
                    print(f"Bid update response: {json.dumps(x, indent=2)}")
                    logging.info(f"Bid update response: {x}")
                    time.sleep(0.5)  # 500ms delay after API request
            except Exception as e:
                print(f"Error updating bid: {e}")
                logging.error(f"Error updating bid: {e}")

    print(f"\n=== SUMMARY ===")
    print(f"Total Active GPUs: {active_gpus}")
    print(f"Check completed at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 40)

def main():
    print("Starting VastAI GPU monitoring script New updated...")
    print("Checking every 15 seconds...")
    print("-" * 40)
    logging.info("Starting VastAI GPU monitoring script")

    while True:
        try:
            check_and_create_instances()
            time.sleep(15)  # Wait for 15 seconds before next check
        except Exception as e:
            error_msg = f"Error occurred: {e}"
            print(error_msg)
            logging.error(error_msg)
            print("Waiting 15 seconds before retry...")
            time.sleep(15)

if __name__ == "__main__":
    main()
