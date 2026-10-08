from ucimlrepo import fetch_ucirepo 
import pandas as pd
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

print("Fetching UCI Heart Disease dataset...")
heart_disease = fetch_ucirepo(id=45)

X = heart_disease.data.features 
y = heart_disease.data.targets 

df = pd.concat([X, y], axis=1)
df.to_csv('data/heart_disease.csv', index=False)

print("Saved to data/heart_disease.csv")
print("Columns:", df.columns.tolist())
