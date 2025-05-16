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

    # Check available machines
    machines_raw = vast_sdk.search_offers(
        order='flops_per_dphtotal',
        type="interruptible",
        query="gpu_name=RTX_4090", 
        raw=True
    )
    machines = json.loads(machines_raw)
    time.sleep(0.5)  # 500ms delay after API request

    # Print information for each machine
    for machine in machines:
        cost_per_gpu = machine['dph_total'] / machine['num_gpus']
        print(f"Found machine {machine['id']} with {machine['num_gpus']} x {machine['gpu_name']} at ${cost_per_gpu:.3f}/GPU/hr")
        logging.info(f"Found machine {machine['id']} with {machine['num_gpus']} x {machine['gpu_name']} at ${cost_per_gpu:.3f}/GPU/hr")
        
        if cost_per_gpu <= 0.2: # Set ceiling to $0.2/h
            print(f"Machine ID: {machine['id']}")
            print(f"Number of GPUs: {machine['num_gpus']}")
            print(f"Total Cost per hour: ${machine['dph_total']:.2f}")
            print(f"Cost per GPU per hour: ${cost_per_gpu:.2f}")
            print("-" * 40)
            bid_price = machine['dph_total'] * 2.1 # place a bid that is 110% above min
            print(f"Setting initial bid at ${bid_price:.3f} (110% above ${machine['dph_total']:.2f})")
            print(f"Placing bid on machine {machine['id']} at ${bid_price:.3f} total (${bid_price/machine['num_gpus']:.3f}/GPU)")
            logging.info(f"Placing bid on machine {machine['id']} at ${bid_price:.3f} total (${bid_price/machine['num_gpus']:.3f}/GPU)")
            x = vast_sdk.create_instance(
                ID=machine['id'],
                template_hash=template_hash,
                price=bid_price
            )
            print(f"Bid response: {x}")
            logging.info(f"Bid response: {x}")
            time.sleep(0.5)  # 500ms delay after API request

    # Check instances
    instances_raw = vast_sdk.show_instances(raw=True)
    instances = json.loads(instances_raw)
    time.sleep(0.5)  # 500ms delay after API request
    active_gpus = 0

    for instance in instances:
        if instance['actual_status'] == "running":
            active_gpus += instance['num_gpus']
            print(f"Instance {instance['id']} running with {instance['num_gpus']} GPUs")
            logging.info(f"Instance {instance['id']} running with {instance['num_gpus']} GPUs")
        if instance['is_bid'] == True and instance['intended_status'] == "stopped":
            cost_per_gpu = machine['dph_total'] / machine['num_gpus']
            if cost_per_gpu <= 0.2: # Set ceiling to $0.2/h
                bid_price = instance['min_bid'] * 2.1
                print(f"Updating bid on instance {instance['id']} to ${bid_price:.3f} (was ${instance['min_bid']:.3f})")
                logging.info(f"Updating bid on instance {instance['id']} to ${bid_price:.3f} (was ${instance['min_bid']:.3f})")
                x = vast_sdk.change_bid(id=instance['id'], price=bid_price)
                print(f"Changed bid for instance {instance['id']} - {instance['num_gpus']} GPUs at ${bid_price:.3f} total (${(bid_price/instance['num_gpus']):.3f}/GPU)")
                print(f"Original price was ${instance['min_bid']:.2f}")
                print(f"Bid update response: {x}")
                logging.info(f"Bid update response: {x}")
                time.sleep(0.5)  # 500ms delay after API request

    print(f"Active GPUs: {active_gpus}")
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
