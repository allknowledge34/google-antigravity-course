import pandas as pd
import numpy as np

df = pd.read_csv('data/heart_disease.csv')

print("1. Shape:", df.shape)
print("\n2. Columns:", df.columns.tolist())
print("\n3. Data types:\n", df.dtypes)
print("\n4. Missing values per column:\n", df.isna().sum())
print("\n5. Duplicate rows:", df.duplicated().sum())

print("\n6. Numerical features:", df.select_dtypes(include=[np.number]).columns.tolist())
print("\n7. Categorical features:", df.select_dtypes(exclude=[np.number]).columns.tolist())
print("\n8. Target column: num")
print("\n9. Target class distribution (raw):\n", df['num'].value_counts())

df['target'] = (df['num'] > 0).astype(int)
print("\nNormalized target distribution (binary):\n", df['target'].value_counts())
